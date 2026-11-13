// Frida and frida-il2cpp-bridge globals as the port provides them. esbuild does not type-check;
// these keep editors quiet without pulling in the full typings.
declare const Il2Cpp: any;
declare const Interceptor: any;
declare const Process: any;
declare const NativeFunction: any;
declare const Memory: any;
declare function ptr(v: number | string): any;
declare class File { constructor(path: string, mode: string); write(data: ArrayBuffer | string): void; flush(): void; close(): void; }
