class JSONDecodeError extends Error {
  msg: string;
  doc: string;
  pos: number;
  lineno: number;
  colno: number;

  constructor(msg: string, doc: string, pos: number) {
    super(JSONDecodeError.errorMessage(msg, doc, pos));
    this.msg = msg;
    this.doc = doc;
    this.pos = pos;
    const [lineno, colno] = JSONDecodeError.lineCol(doc, pos);
    this.lineno = lineno;
    this.colno = colno;
  }

  private static lineCol(doc: string, pos: number): [number, number] {
    const lineno = doc.substring(0, pos).split('\n').length;
    const colno = pos - doc.lastIndexOf('\n', pos - 1) - 1;
    return [lineno, colno];
  }

  private static errorMessage(msg: string, doc: string, pos: number): string {
    const [lineno, colno] = JSONDecodeError.lineCol(doc, pos);
    return `${msg}: line ${lineno} column ${colno} (char ${pos})`;
  }
}

// Export the class for use in other modules
export { JSONDecodeError };
