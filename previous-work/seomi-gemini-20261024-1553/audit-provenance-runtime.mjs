import {mkdtempSync,writeFileSync,readFileSync,symlinkSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import * as api from '/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/scripts/release-ci-gate-provenance.mjs';
const root=mkdtempSync(join(tmpdir(),'seomi-provenance-audit-'));const artifactDir=join(root,'artifacts');
const {mkdirSync}=await import('node:fs');mkdirSync(artifactDir);
const names=[['SEOmi_aarch64.app.tar.gz','darwin-aarch64-app'],['SEOmi_x64.app.tar.gz','darwin-x86_64-app'],['SEOmi_0.4.40_x64-setup.exe','windows-x86_64-setup'],['SEOmi_0.4.40_x64_en-US.msi','windows-x86_64-msi'],['latest.json','manifest']];
const cases=[];const sha='a'.repeat(40),version='0.4.40';
try{
 const artifacts=names.map(([name,role])=>{const path=join(artifactDir,name);writeFileSync(path,'controlled fixture for '+name);return{name,role,sha256:api.computeFileSha256(path),size:statSync(path).size};});
 const checksums=api.generateArtifactChecksums({artifactDir,files:names.map(x=>x[0])});
 const inventory=api.buildProvenanceInventory({repository:'tomaszboloz/SEOmi',tag:'v0.4.40',commitSha:sha,version,artifacts,sboms:[]});
 const sbom={bomFormat:'CycloneDX',components:[]};
 writeFileSync(join(artifactDir,names[0][0]),'changed payload after checksums');
 const validAfterMutation=api.validateProvenanceContract({inventory,checksumsContent:checksums,sbomNode:sbom,sbomRust:sbom,expectedSha:sha,expectedVersion:version,artifactDir});
 cases.push({case:'payload bytes change after inventory/checksums creation',expected:'reject before attestation/publication',actual:{accepted:validAfterMutation,oldDigest:artifacts[0].sha256,currentDigest:api.computeFileSha256(join(artifactDir,names[0][0]))}});
 const outside=join(root,'outside.txt');writeFileSync(outside,'controlled outside artifact root');
 symlinkSync(outside,join(artifactDir,'linked.exe'));
 let symlinkResult;try{symlinkResult={accepted:true,checksums:api.generateArtifactChecksums({artifactDir,files:['linked.exe']})};}catch(error){symlinkResult={accepted:false,error:String(error)};}
 cases.push({case:'symlink escapes artifact directory',expected:'reject resolved outside file',actual:symlinkResult});
 let duplicates;try{duplicates={accepted:true,result:api.generateArtifactChecksums({artifactDir,files:[names[1][0],names[1][0]]})};}catch(error){duplicates={accepted:false,error:String(error)};}
 cases.push({case:'duplicate checksum subject',expected:'reject duplicate subject names',actual:duplicates});
 let malformed;try{malformed={accepted:api.validateProvenanceContract({inventory,checksumsContent:checksums,sbomNode:{bomFormat:'CycloneDX',components:{}},sbomRust:{bomFormat:'CycloneDX',components:'invalid'},expectedSha:sha,expectedVersion:version})};}catch(error){malformed={accepted:false,error:String(error)};}
 cases.push({case:'malformed SBOM structures with non-array components',expected:'reject invalid CycloneDX component collections',actual:malformed});
 const workflow=readFileSync('/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/.github/workflows/release.yml','utf8').split('  publish-release:')[1];
 cases.push({case:'publisher workflow invokes generated provenance/checksum pipeline before attest',expected:'real artifact download, checksums, inventory generation and uploads are connected to runtime',actual:{helperInvocationPresent:workflow.includes('release-ci-gate-provenance'),dependencyInstallPresent:/run:.*npm ci/.test(workflow),checksumProducerPresent:/sha256sum|shasum|generateArtifactChecksums|--prepare-provenance/.test(workflow),attestReadsChecksums:workflow.includes('subject-checksums: SHA256SUMS.txt')}});
 const report={at:new Date().toISOString(),scope:'Original Gemini provenance helper on real isolated temporary files plus current publisher source audit; no production mutations, no external publication',cases};
 writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-provenance-runtime-findings.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{rmSync(root,{recursive:true,force:true});}
