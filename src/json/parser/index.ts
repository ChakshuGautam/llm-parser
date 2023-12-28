import { JSONDecodeError } from './errors';
import { fromhex } from './compat';
function getSystemByteOrder(): 'big' | 'little' {
  // Creating a Uint32Array and checking how the bytes are arranged
  const arrayBuffer = new ArrayBuffer(4);
  const uint32Array = new Uint32Array(arrayBuffer);
  const uint8Array = new Uint8Array(arrayBuffer);

  uint32Array[0] = 0x12345678;

  if (uint8Array[0] === 0x78) {
    return 'little';
  } else if (uint8Array[0] === 0x12) {
    return 'big';
  } else {
    throw new JSONDecodeError('Unknown system byte order', '', 0);
  }
}

function _floatconstants(): [number, number, number] {
  let _BYTES = fromhex('7FF80000000000007FF0000000000000');

  let systemByteOrder = getSystemByteOrder();

  // Adjusting for system byte order
  if (systemByteOrder !== 'big') {
    // Create two separate Uint8Array views for each half of the array
    const firstHalf = new Uint8Array(_BYTES.buffer, 0, 8).reverse();
    const secondHalf = new Uint8Array(_BYTES.buffer, 8, 8).reverse();

    // Combine them into a single Uint8Array
    const combined = new Uint8Array(16);
    combined.set(firstHalf, 0);
    combined.set(secondHalf, 8);
    _BYTES = combined;
  }

  // Using DataView for unpacking bytes to float
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  for (let i = 0; i < 16; i++) {
    view.setUint8(i, _BYTES[i]);
  }
  const nan = view.getFloat64(0);
  const inf = view.getFloat64(8);

  return [nan, inf, -inf];
}
// Constants conversion
const [NaN, PosInf, NegInf] = _floatconstants();

const _CONSTANTS: { [key: string]: any } = {
  null: null,
  true: true,
  false: false,
  '-Infinity': NegInf,
  Infinity: PosInf,
  NaN: NaN,
};

// Regular expressions remain the same
const CONSTANT_RE = new RegExp(`(${Object.keys(_CONSTANTS).join('|')})`);
const NUMBER_RE = new RegExp(
  '(-?(?:0x[\\da-fA-F]+|\\d+))(\\.\\d+)?([eE][-+]?\\d+)?'
);
// const EQUATION_RE = new RegExp('[0-9.+-*/eEx&|]*[()[0-9+-*/eEx&|]+');
const EQUATION_RE = new RegExp('[0-9.+\\-*/eEx&|]*[()[0-9.+\\-*/eEx&|]+');
const STRINGCHUNK_DOUBLEQUOTE = new RegExp('(.*?)(["\\\\\\x00-\\x1f])');
const STRINGCHUNK_SINGLEQUOTE = new RegExp("(.*?)(['\\\\\\x00-\\x1f])");
const UNQUOTED_KEYNAME = new RegExp('([\\w_$]+[\\w\\d_$]*)');
const WHITESPACE_STR = ' \t\n\r';
const WHITESPACE = new RegExp(`[${WHITESPACE_STR}]*`, 'g');

// Define the type for BufferEncoding
type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf16le'
  | 'ucs2'
  | 'base64'
  | 'latin1'
  | 'binary'
  | 'hex';

// Type guard to check if a string is a BufferEncoding
function isBufferEncoding(encoding: string): encoding is BufferEncoding {
  const validEncodings: BufferEncoding[] = [
    'ascii',
    'utf8',
    'utf16le',
    'ucs2',
    'base64',
    'latin1',
    'binary',
    'hex',
  ];
  return validEncodings.includes(encoding as BufferEncoding);
}

// Conversion of the BACKSLASH dictionary
const BACKSLASH: { [key: string]: string } = {
  '"': '"',
  "'": "'",
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};
const DEFAULT_ENCODING = 'utf-8';

// Position class conversion
class Position {
  line: number;
  column: number;

  constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }

  lessThan(other: Position): boolean {
    if (this.line > other.line) {
      return false;
    }
    return this.line < other.line || this.column < other.column;
  }
}

// KeyValuePosition class conversion
class KeyValuePosition {
  key: Position;
  value: Position;

  constructor(keyPosition: Position, valuePosition: Position) {
    this.key = keyPosition;
    this.value = valuePosition;
  }
}

// Beginning of DirtyJSONLoader class conversion
class DirtyJSONLoader {
  private encoding: string;
  private parseFloat: (value: string) => number;
  private parseInt: (value: string, radix?: number) => number;
  private parseConstant: (value: string) => any;
  //   private memo: { [key: string]: any };
  private content: string;
  private end: number;
  private lineno: number;
  private currentLinePos: number;
  private pos: number;
  private expecting: string;

  constructor(
    content: string,
    encoding?: string,
    parseFloatFn?: (value: string) => number,
    parseIntFn?: (value: string, radix?: number) => number,
    parseConstant?: (value: string) => any
  ) {
    this.encoding = encoding || DEFAULT_ENCODING;
    this.parseFloat = parseFloatFn || parseFloat; // Use global parseFloat if not provided
    this.parseInt = parseIntFn || parseInt; // Use global parseInt if not provided
    this.parseConstant = parseConstant || ((key: string) => _CONSTANTS[key]);
    // this.memo = {};

    // Adjusting content handling for TypeScript
    if (typeof content === 'string') {
      this.content = content;
    } else {
      throw new JSONDecodeError('Invalid content type', '', 0);
    }

    // Encoding check and conversion
    if (this.encoding !== DEFAULT_ENCODING) {
      let fixed = '';
      if (isBufferEncoding(this.encoding)) {
        fixed = Buffer.from(this.content).toString(this.encoding);
      } else {
        throw new JSONDecodeError(`Invalid encoding: ${this.encoding}`, '', 0);
      }
      if (this.content !== fixed) {
        for (let index = 0; index < this.content.length; index++) {
          if (this.content[index] !== fixed[index]) {
            throw new JSONDecodeError(
              `Non-${this.encoding} character ${this.content[index]}`,
              '',
              0
            );
          }
        }
      }
    }

    this.end = this.content.length;
    this.lineno = 1;
    this.currentLinePos = 0;
    this.pos = 0;
    this.expecting = 'Expecting value';
  }
  // Implementing _nextCharacter method
  private _nextCharacter(): string {
    try {
      const nextChar = this.content[this.pos];
      this.pos += 1;
      return nextChar;
    } catch (error) {
      throw new JSONDecodeError(this.expecting, this.content, this.pos);
    }
  }

  // Implementing _nextCharacterAfterWhitespace method
  private _nextCharacterAfterWhitespace(): string {
    try {
      let nextChar = this.content[this.pos];
      if (WHITESPACE_STR.includes(nextChar)) {
        this._skipWhitespace();
        nextChar = this.content[this.pos];
      }
      this.pos += 1;
      return nextChar;
    } catch (error) {
      return '';
    }
  }

  // Implementing _skipWhitespace method
  private _skipWhitespace(): void {
    while (true) {
      const match = WHITESPACE.exec(this.content.substring(this.pos));
      if (match) {
        this._skipForwardTo(this.pos + match[0].length);
      }
      if (this.pos > this.end - 2) {
        break;
      }
      const twoChars = this.content.substring(this.pos, this.pos + 2);
      if (twoChars === '//' || twoChars === '/*') {
        const terminator = twoChars === '//' ? '\n' : '*/';
        const lf = this.content.indexOf(terminator, this.pos);
        if (lf >= 0) {
          this._skipForwardTo(lf + terminator.length);
        } else {
          this._skipForwardTo(this.end);
          break;
        }
      } else {
        break;
      }
    }
  }

  // Implementing _skipForwardTo method
  private _skipForwardTo(end: number): void {
    if (end !== this.pos) {
      const linefeeds = (
        this.content.substring(this.pos, end).match(/\n/g) || []
      ).length;
      if (linefeeds) {
        this.lineno += linefeeds;
        const rpos = this.content.lastIndexOf('\n', end);
        this.currentLinePos = rpos + 1;
      }
      this.pos = end;
    }
  }

  // Implementing _currentPosition method
  private _currentPosition(offset = 0): Position {
    return new Position(
      this.lineno,
      this.pos - this.currentLinePos + 1 + offset
    );
  }

  // Implementing scan method
  scan(): any {
    this.expecting = 'Expecting value';
    let nextChar = this._nextCharacter();

    switch (nextChar) {
      case '"':
      case "'":
        return this.parseString(nextChar);
      case '{':
        return this.parseObject();
      case '[':
        return this.parseArray();
      default:
        this.pos -= 1;
        const constantMatch = CONSTANT_RE.exec(
          this.content.substring(this.pos)
        );
        if (constantMatch) {
          this.pos += constantMatch[0].length;
          return this.parseConstant(constantMatch[0]);
        }

        const numberMatch = NUMBER_RE.exec(this.content.substring(this.pos));
        if (numberMatch) {
          this.pos += numberMatch[0].length;
          return this.parseNumber(numberMatch);
        }

        const equationMatch = EQUATION_RE.exec(
          this.content.substring(this.pos)
        );
        if (equationMatch) {
          try {
            const res = eval(equationMatch[0]);
            this.pos += equationMatch[0].length;
            return res;
          } catch (error) {
            throw new JSONDecodeError(
              'Cannot evaluate expression',
              this.content,
              this.pos
            );
          }
        }

        console.log('Line:325', this.expecting, this.content, this.pos);
        throw new JSONDecodeError(this.expecting, this.content, this.pos);
    }
  }

  // Implementing parseNumber method
  private parseNumber(match: RegExpExecArray): number {
    const [integer, frac, exp] = match.slice(1);
    if (frac || exp) {
      return this.parseFloat(integer + (frac || '') + (exp || ''));
    } else {
      try {
        return this.parseInt(integer, 0);
      } catch (error) {
        if (integer.startsWith('0')) {
          return this.parseInt('0o' + integer.substring(1), 0);
        } else {
          throw error;
        }
      }
    }
  }
  // Implementing parseString method
  private parseString(terminatingCharacter: string): string {
    const _m =
      terminatingCharacter === '"'
        ? STRINGCHUNK_DOUBLEQUOTE
        : STRINGCHUNK_SINGLEQUOTE;
    const chunks: string[] = [];
    const begin = this.pos - 1;

    while (true) {
      const chunk = _m.exec(this.content.substring(this.pos));
      if (!chunk) {
        throw new JSONDecodeError(
          'Unterminated string starting at',
          this.content,
          begin
        );
      }
      this.pos += chunk[0].length;
      const [content, terminator] = chunk.slice(1);

      if (content) {
        chunks.push(content);
      }

      if (
        terminator === terminatingCharacter ||
        (terminatingCharacter === '"' && terminator === "'") ||
        (terminatingCharacter === "'" && terminator === '"')
      ) {
        break;
      } else if (terminator !== '\\') {
        chunks.push(terminator);
        continue;
      }

      // Handle escape sequences
      const esc = this.content[this.pos];
      if (esc !== 'u') {
        try {
          const char = BACKSLASH[esc];
          chunks.push(char);
          this.pos += 1;
        } catch (error) {
          throw new JSONDecodeError(
            `Invalid \\X escape sequence ${esc}`,
            this.content,
            this.pos
          );
        }
      } else {
        // Unicode escape sequence
        // Handle Unicode escape sequence
        if (esc === 'u') {
          const escSequence = this.content.substring(
            this.pos + 1,
            this.pos + 5
          );
          if (escSequence.length !== 4 || /[xX]/.test(escSequence)) {
            throw new JSONDecodeError(
              `Invalid \\uXXXX escape sequence`,
              this.content,
              this.pos - 1
            );
          }
          try {
            const uniChar = String.fromCharCode(parseInt(escSequence, 16));
            chunks.push(uniChar);
            this.pos += 5;
          } catch (error) {
            throw new JSONDecodeError(
              `Invalid \\uXXXX escape sequence`,
              this.content,
              this.pos - 1
            );
          }
        }
        return chunks.join('');
        // Implementation to be added
      }
    }

    return chunks.join('');
  }

  // Completing parseObject method
  private parseObject(): AttributedDict {
    const obj = new AttributedDict();
    let nextChar = this._nextCharacterAfterWhitespace();

    while (true) {
      if (nextChar === '}') {
        break;
      }

      let key: string;
      const keyPos = this._currentPosition(-nextChar.length);
      if (nextChar === '"' || nextChar === "'") {
        key = this.parseString(nextChar);
      } else {
        const chunk = UNQUOTED_KEYNAME.exec(
          this.content.substring(this.pos - 1)
        );
        if (!chunk) {
          throw new JSONDecodeError(
            'Expecting property name',
            this.content,
            this.pos
          );
        }
        this.pos += chunk[0].length;
        key = chunk[0];
      }

      if (this._nextCharacterAfterWhitespace() !== ':') {
        throw new JSONDecodeError(
          "Expecting ':' delimiter",
          this.content,
          this.pos
        );
      }

      this._skipWhitespace();
      const valuePos = this._currentPosition();
      const value = this.scan();
      obj.addWithAttributes(key, value, new KeyValuePosition(keyPos, valuePos));

      nextChar = this._nextCharacterAfterWhitespace();
      if (nextChar !== ',' && nextChar !== '}') {
        throw new JSONDecodeError(
          "Expecting ',' delimiter or '}'",
          this.content,
          this.pos - nextChar.length
        );
      }
    }

    return obj;
  }

  // Completing parseArray method
  private parseArray(): AttributedList {
    const values = new AttributedList();
    let nextChar = this._nextCharacterAfterWhitespace();

    while (true) {
      if (nextChar === ']') {
        break;
      }

      this.pos -= nextChar.length;
      const valuePos = this._currentPosition();
      const value = this.scan();
      values.append(value, valuePos);

      nextChar = this._nextCharacterAfterWhitespace();
      if (nextChar !== ',' && nextChar !== ']') {
        throw new JSONDecodeError(
          "Expecting ',' delimiter or ']'",
          this.content,
          this.pos - nextChar.length
        );
      }
    }

    return values;
  }

  // Implementing decode method
  decode(searchForFirstObject: boolean = false, startIndex: number = 0): any {
    if (startIndex) {
      this._skipForwardTo(startIndex);
    }

    if (searchForFirstObject) {
      const i = this.content.indexOf('[', this.pos);
      const o = this.content.indexOf('{', this.pos);
      let index = o;
      if (i > o || i < 0) {
        index = i;
      }
      if (index >= this.pos) {
        this._skipForwardTo(index);
      }
    }

    this._skipWhitespace();
    return this.scan();
  }
}

// function linecol(doc: string, pos: number): [number, number] {
//   const lineno = doc.substring(0, pos).split('\n').length;
//   const colno = pos - (doc.lastIndexOf('\n', pos - 1) + 1);
//   return [lineno, colno];
// }

// function errmsg(msg: string, doc: string, pos: number): string {
//   const [lineno, colno] = linecol(doc, pos);
//   return `${msg}: line ${lineno} column ${colno} (char ${pos})`;
// }

class AttributedDict {
  private data: { [key: string]: any };
  private attributes: { [key: string]: any };

  constructor() {
    this.data = {};
    this.attributes = {};
  }

  addWithAttributes(key: string, value: any, attributes: any): void {
    this.data[key] = value;
    this.attributes[key] = attributes;
  }

  getAttributes(key: string): any {
    return this.attributes[key];
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, value: any): void {
    this.data[key] = value;
  }
}

// AttributedList class conversion
class AttributedList {
  private list: any[];
  private attributes: any[];

  constructor() {
    this.list = [];
    this.attributes = [];
  }

  append(item: any, attributes: any): void {
    this.list.push(item);
    this.attributes.push(attributes);
  }

  getAttributes(index: number): any {
    return this.attributes[index];
  }

  get(index: number): any {
    return this.list[index];
  }
}

export { DirtyJSONLoader, AttributedDict };
