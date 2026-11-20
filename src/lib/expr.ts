// Безопасный вычислитель выражений: без eval/new Function, только белый список функций.
// Поддержка: числа, строки ('..' или ".."), переменные, доступ к полям (p1.price),
// + - * / ^, сравнения, && || !, тернарный ?:, вызовы функций из белого списка.

export type Value = number | string | boolean | Record<string, unknown> | null | undefined
export type Scope = Record<string, unknown>
export type Fn = (...args: unknown[]) => unknown

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'var'; name: string }
  | { t: 'member'; obj: Node; prop: string }
  | { t: 'call'; name: string; args: Node[] }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'tern'; c: Node; a: Node; b: Node }

type Tok = { k: 'num' | 'str' | 'id' | 'op'; v: string }

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])
const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '^', '(', ')', ',', '.', '?', ':', '<', '>', '!']

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/.exec(src.slice(i))!
      out.push({ k: 'num', v: m[0] }); i += m[0].length; continue
    }
    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1)
      if (end < 0) throw new Error('Незакрытая строка')
      out.push({ k: 'str', v: src.slice(i + 1, end) }); i = end + 1; continue
    }
    if (/[A-Za-z_А-Яа-яЁё]/.test(ch)) {
      const m = /^[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/.exec(src.slice(i))!
      out.push({ k: 'id', v: m[0] }); i += m[0].length; continue
    }
    const op = OPS.find((o) => src.startsWith(o, i))
    if (!op) throw new Error(`Непонятный символ «${ch}»`)
    out.push({ k: 'op', v: op }); i += op.length
  }
  return out
}

class Parser {
  private p = 0
  constructor(private toks: Tok[]) {}
  private peek() { return this.toks[this.p] }
  private isOp(v: string) { const t = this.peek(); return t && t.k === 'op' && t.v === v }
  private eat(v: string) { if (!this.isOp(v)) throw new Error(`Ожидалось «${v}»`); this.p++ }
  parse(): Node {
    const n = this.ternary()
    if (this.p < this.toks.length) throw new Error(`Лишнее «${this.peek().v}»`)
    return n
  }
  private ternary(): Node {
    const c = this.bin(0)
    if (this.isOp('?')) { this.p++; const a = this.ternary(); this.eat(':'); const b = this.ternary(); return { t: 'tern', c, a, b } }
    return c
  }
  private static LEVELS = [['||'], ['&&'], ['==', '!=', '<', '>', '<=', '>='], ['+', '-'], ['*', '/']]
  private bin(level: number): Node {
    if (level >= Parser.LEVELS.length) return this.unary()
    let a = this.bin(level + 1)
    while (this.peek()?.k === 'op' && Parser.LEVELS[level].includes(this.peek().v)) {
      const op = this.toks[this.p++].v
      a = { t: 'bin', op, a, b: this.bin(level + 1) }
    }
    return a
  }
  private unary(): Node {
    if (this.isOp('-') || this.isOp('+') || this.isOp('!')) { const op = this.toks[this.p++].v; return { t: 'un', op, a: this.unary() } }
    return this.pow()
  }
  private pow(): Node {
    const a = this.postfix()
    if (this.isOp('^')) { this.p++; return { t: 'bin', op: '^', a, b: this.unary() } }
    return a
  }
  private postfix(): Node {
    let n = this.primary()
    while (this.isOp('.')) {
      this.p++
      const t = this.peek()
      if (!t || t.k !== 'id') throw new Error('Ожидалось имя поля')
      this.p++
      n = { t: 'member', obj: n, prop: t.v }
    }
    return n
  }
  private primary(): Node {
    const t = this.peek()
    if (!t) throw new Error('Неожиданный конец выражения')
    this.p++
    if (t.k === 'num') return { t: 'num', v: parseFloat(t.v) }
    if (t.k === 'str') return { t: 'str', v: t.v }
    if (t.k === 'id') {
      if (this.isOp('(')) {
        this.p++
        const args: Node[] = []
        if (!this.isOp(')')) { do { args.push(this.ternary()) } while (this.isOp(',') && ++this.p) }
        this.eat(')')
        return { t: 'call', name: t.v, args }
      }
      return { t: 'var', name: t.v }
    }
    if (t.v === '(') { const n = this.ternary(); this.eat(')'); return n }
    throw new Error(`Неожиданное «${t.v}»`)
  }
}

const cache = new Map<string, Node>()
export function compile(src: string): Node {
  let n = cache.get(src)
  if (!n) { n = new Parser(tokenize(src)).parse(); cache.set(src, n) }
  return n
}

const own = (o: unknown, k: string) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)

export const BASE_FUNCS: Record<string, Fn> = {
  round: (x, d = 0) => { const f = 10 ** Number(d); return Math.round(Number(x) * f) / f },
  floor: (x) => Math.floor(Number(x)),
  ceil: (x) => Math.ceil(Number(x)),
  abs: (x) => Math.abs(Number(x)),
  min: (...a) => Math.min(...a.map(Number)),
  max: (...a) => Math.max(...a.map(Number)),
}

export function evaluate(src: string, scope: Scope, funcs: Record<string, Fn> = BASE_FUNCS): unknown {
  const run = (n: Node): unknown => {
    switch (n.t) {
      case 'num': return n.v
      case 'str': return n.v
      case 'var':
        if (FORBIDDEN.has(n.name) || !own(scope, n.name)) throw new Error(`Неизвестное имя «${n.name}»`)
        return scope[n.name]
      case 'member': {
        const o = run(n.obj)
        if (FORBIDDEN.has(n.prop) || !own(o, n.prop)) throw new Error(`Нет поля «${n.prop}»`)
        return (o as Record<string, unknown>)[n.prop]
      }
      case 'call': {
        if (!own(funcs, n.name)) throw new Error(`Неизвестная функция «${n.name}»`)
        return funcs[n.name](...n.args.map(run))
      }
      case 'un': {
        const a = run(n.a)
        return n.op === '-' ? -Number(a) : n.op === '+' ? Number(a) : !a
      }
      case 'tern': return run(n.c) ? run(n.a) : run(n.b)
      case 'bin': {
        if (n.op === '&&') return run(n.a) && run(n.b)
        if (n.op === '||') return run(n.a) || run(n.b)
        const a = run(n.a), b = run(n.b)
        switch (n.op) {
          case '+': return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : Number(a) + Number(b)
          case '-': return Number(a) - Number(b)
          case '*': return Number(a) * Number(b)
          case '/': return Number(a) / Number(b)
          case '^': return Number(a) ** Number(b)
          case '==': return a === b
          case '!=': return a !== b
          case '<': return Number(a) < Number(b)
          case '>': return Number(a) > Number(b)
          case '<=': return Number(a) <= Number(b)
          case '>=': return Number(a) >= Number(b)
        }
      }
    }
    throw new Error('Неизвестный узел')
  }
  return run(compile(src))
}

export function evalNum(src: string, scope: Scope): number {
  const v = evaluate(src, scope)
  const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v)
  if (!Number.isFinite(n)) throw new Error(`Выражение «${src}» не дало число`)
  return n
}
