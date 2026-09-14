declare module 'pdfmake/build/pdfmake.js' {
  const pdfMake: {
    addVirtualFileSystem: (vfs: Record<string, string>) => void
    createPdf: (docDefinition: unknown) => {
      download: (filename: string) => Promise<void>
      open: () => Promise<void>
    }
  }
  export default pdfMake
}
