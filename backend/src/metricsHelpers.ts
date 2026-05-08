/**
 * Shared metric computation helpers used by all language adapters.
 * All functions operate on raw source code strings and use regex-based
 * approximations — they are language-agnostic unless a language parameter
 * is provided.
 */

// ---------------------------------------------------------------------------
// Halstead Volume (simplified)
// ---------------------------------------------------------------------------

/**
 * Compute an approximation of Halstead Volume.
 *
 * Volume = N * log2(n)  where N = total operator + operand tokens,
 *                              n = distinct operator + operand vocabulary.
 *
 * String literals and comments are stripped before counting so that
 * their contents do not pollute the operator/operand sets.
 */
export function computeHalstead(code: string): number {
  // Strip block comments, line comments, and string/template literals.
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/--[^\n]*/g, " ")          // Haskell / Lua
    .replace(/#[^\n]*/g, " ")           // Python / Ruby / Shell
    .replace(/`(?:[^`\\]|\\.)*`/g, " STRING ")
    .replace(/"(?:[^"\\]|\\.)*"/g, " STRING ")
    .replace(/'(?:[^'\\]|\\.)*'/g, " STRING ");

  // Operators: multi-char tokens first, then single chars.
  const opRegex =
    /(\+\+|--|>>>|<<=|>>=|===|!==|==|!=|<=|>=|=>|->|\?\?|\*\*|&&|\|\||<<|>>|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[+\-*/%=<>!&|^~?:;,.()[\]{}])/g;
  const opTokens = stripped.match(opRegex) ?? [];
  const n1 = new Set(opTokens).size;
  const N1 = opTokens.length;

  // Known language keywords that are not operands.
  const KEYWORDS = new Set([
    "if","else","for","while","do","switch","case","break","continue","return",
    "function","class","const","let","var","def","import","export","from","new",
    "this","super","null","true","false","void","static","public","private",
    "protected","abstract","interface","extends","implements","try","catch",
    "finally","throw","typeof","instanceof","in","of","async","await","yield",
    "with","delete","debugger",
    // Rust
    "fn","struct","enum","impl","use","mod","pub","mut","move","ref","where",
    "type","match","trait","derive","crate","unsafe","extern","dyn","Self",
    // Go
    "func","package","go","chan","map","select","defer","range","make","nil",
    // Kotlin
    "when","is","as","object","companion","fun","val","override","data","sealed",
    // Haskell / Elm
    "module","exposing","and","or","not","then","begin","end","newtype","lambda",
    // Swift
    "guard","protocol",
    // Generic
    "STRING","int","bool","string","float","double","long","short","char","byte",
  ]);

  const operandRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$']*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g;
  const operandTokens = (stripped.match(operandRegex) ?? []).filter(
    (t) => !KEYWORDS.has(t)
  );
  const n2 = new Set(operandTokens).size;
  const N2 = operandTokens.length;

  const n = n1 + n2;
  const N = N1 + N2;

  if (n < 2 || N === 0) return 0;
  return Math.round(N * Math.log2(n));
}

// ---------------------------------------------------------------------------
// Maintainability Index
// ---------------------------------------------------------------------------

/**
 * Compute the Maintainability Index (0–100).
 *
 * Formula (Microsoft / SEI variant):
 *   MI = max(0, (171 - 5.2·ln(HV) - 0.23·CC - 16.2·ln(LOC)) × 100 / 171)
 *
 * A score of 100 is perfectly maintainable; 0 is unmaintainable.
 */
export function computeMaintainabilityIndex(
  halstead_volume: number,
  complexity: number,
  loc_total: number,
): number {
  if (loc_total === 0) return 100;
  const hv  = Math.max(1, halstead_volume);
  const loc = Math.max(1, loc_total);
  const raw = 171 - 5.2 * Math.log(hv) - 0.23 * complexity - 16.2 * Math.log(loc);
  return Math.round(Math.max(0, Math.min(100, (raw * 100) / 171)));
}

// ---------------------------------------------------------------------------
// Nesting Depth
// ---------------------------------------------------------------------------

/**
 * Compute the maximum nesting depth of a source file.
 *
 * - Curly-brace languages: counts `{` / `}` pairs after stripping comments
 *   and strings.
 * - Python: infers depth from indentation level.
 * - Haskell / Elm: infers depth from indentation level (min-indent unit).
 */
export function computeNestingDepth(code: string, language: string): number {
  if (language === "Python") {
    return computeIndentNesting(code, 4);
  }
  if (language === "Haskell" || language === "Elm") {
    return computeIndentNesting(code, 2);
  }

  // Curly-brace languages — strip comments and strings first.
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "")
    .replace(/`(?:[^`\\]|\\.)*`/g, "");

  let depth = 0;
  let max = 0;
  for (const ch of stripped) {
    if (ch === "{") {
      depth++;
      if (depth > max) max = depth;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

function computeIndentNesting(code: string, unitHint: number): number {
  let max = 0;
  for (const line of code.split("\n")) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const depth = Math.ceil(indent / unitHint);
    if (depth > max) max = depth;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Max Function Parameters (NOP)
// ---------------------------------------------------------------------------

/**
 * Compute the maximum number of parameters across all function/method
 * definitions in the source file.
 *
 * Counts commas at depth 0 inside the parameter list (so nested generics
 * like `Map<K, V>` are not double-counted).
 */
export function computeMaxParams(code: string): number {
  const patterns: RegExp[] = [
    // JS / TS: function name(...) or function(...)
    /\bfunction\s*\*?\s*\w*\s*\(([^)]*)\)/g,
    // Python / Ruby: def name(...)
    /\bdef\s+\w+\s*\(([^)]*)\)/g,
    // Rust: fn name<...>(...)
    /\bfn\s+\w+(?:<[^>]*>)?\s*\(([^)]*)\)/g,
    // Go / Swift: func name(...)
    /\bfunc\s+\w+(?:<[^>]*>)?\s*\(([^)]*)\)/g,
    // Kotlin: fun name(...)
    /\bfun\s+\w+(?:<[^>]*>)?\s*\(([^)]*)\)/g,
    // Arrow functions with params: (a, b) =>
    /\(([^)]{2,})\)\s*=>/g,
  ];

  let max = 0;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(code)) !== null) {
      const paramStr = m[1].trim();
      if (!paramStr) continue;

      // Count commas at bracket depth 0.
      let depth = 0;
      let count = 1;
      for (const ch of paramStr) {
        if (ch === "<" || ch === "[" || ch === "(") depth++;
        else if (ch === ">" || ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
        else if (ch === "," && depth === 0) count++;
      }
      if (count > max) max = count;
    }
  }

  return max;
}
