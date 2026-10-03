param([Parameter(Mandatory=$true)][string]$Executable)
$ErrorActionPreference = 'Stop'
# Inspect direct PE imports without executing the failing desktop application.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
public static class DesktopLoaderDiagnostics {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr LoadLibraryW(string path);
    [DllImport("kernel32.dll", CharSet=CharSet.Ansi, ExactSpelling=true)]
    static extern IntPtr GetProcAddress(IntPtr module, string name);
    [DllImport("kernel32.dll", EntryPoint="GetProcAddress", ExactSpelling=true)]
    static extern IntPtr GetOrdinal(IntPtr module, IntPtr ordinal);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)]
    static extern bool SetDllDirectoryW(string path);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)]
    static extern uint GetModuleFileNameW(IntPtr module, StringBuilder path, int size);
    [DllImport("kernel32.dll")]
    static extern bool FreeLibrary(IntPtr module);
    static int Offset(byte[] bytes, int sections, int count, uint rva) {
        for (int i=0; i<count; i++) {
            int section=sections+i*40;
            uint address=BitConverter.ToUInt32(bytes,section+12);
            uint size=Math.Max(BitConverter.ToUInt32(bytes,section+8),BitConverter.ToUInt32(bytes,section+16));
            if (rva>=address && rva-address<size)
                return checked((int)(rva-address+BitConverter.ToUInt32(bytes,section+20)));
        }
        throw new InvalidDataException("RVA outside PE sections: " + rva);
    }
    static string CString(byte[] bytes, int offset) {
        int end=offset;
        while(bytes[end]!=0) end++;
        return Encoding.ASCII.GetString(bytes,offset,end-offset);
    }
    public static void Inspect(string executable) {
        byte[] bytes=File.ReadAllBytes(executable);
        int pe=BitConverter.ToInt32(bytes,0x3c);
        int count=BitConverter.ToUInt16(bytes,pe+6);
        int optional=pe+24;
        bool wide=BitConverter.ToUInt16(bytes,optional)==0x20b;
        int sections=optional+BitConverter.ToUInt16(bytes,pe+20);
        uint imports=BitConverter.ToUInt32(bytes,optional+(wide?120:104));
        Console.WriteLine("PE direct import diagnostics: " + executable);
        if(imports==0) return;
        SetDllDirectoryW(Path.GetDirectoryName(executable));
        try {
            int descriptor=Offset(bytes,sections,count,imports);
            while(BitConverter.ToUInt32(bytes,descriptor+12)!=0) {
                string dll=CString(bytes,Offset(bytes,sections,count,BitConverter.ToUInt32(bytes,descriptor+12)));
                IntPtr module=LoadLibraryW(dll);
                if(module==IntPtr.Zero) Console.WriteLine("LOAD FAILED: " + dll + " win32=" + Marshal.GetLastWin32Error());
                else {
                    try {
                        var path=new StringBuilder(32768);
                        GetModuleFileNameW(module,path,path.Capacity);
                        Console.WriteLine("LOADED: " + dll + " => " + path);
                        uint thunk=BitConverter.ToUInt32(bytes,descriptor);
                        if(thunk==0) thunk=BitConverter.ToUInt32(bytes,descriptor+16);
                        int entry=Offset(bytes,sections,count,thunk);
                        ulong mask=wide?0x8000000000000000UL:0x80000000UL;
                        while(true) {
                            ulong value=wide?BitConverter.ToUInt64(bytes,entry):BitConverter.ToUInt32(bytes,entry);
                            if(value==0) break;
                            bool ordinal=(value & mask)!=0;
                            string name=ordinal?"#"+(value&0xffff):CString(bytes,Offset(bytes,sections,count,(uint)value)+2);
                            IntPtr symbol=ordinal?GetOrdinal(module,new IntPtr((int)(value&0xffff))):GetProcAddress(module,name);
                            if(symbol==IntPtr.Zero) Console.WriteLine("ENTRYPOINT MISSING: " + dll + "!" + name);
                            entry+=wide?8:4;
                        }
                    } finally { FreeLibrary(module); }
                }
                descriptor+=20;
            }
        } finally { SetDllDirectoryW(null); }
    }
}
'@
[DesktopLoaderDiagnostics]::Inspect((Resolve-Path $Executable).Path)
