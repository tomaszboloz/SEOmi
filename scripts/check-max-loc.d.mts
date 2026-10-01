export function codeFiles(directory:string):string[];
export function maxLocReport(files:string[],limit?:number): {limit:number;files:number;violations:Array<{file:string;lines:number}>};
