use wasm_bindgen::prelude::*;
use std::collections::{HashMap, HashSet};
use serde_json;
use js_sys::Date as JsDate;

/// Token types produced by the tokenizer
#[derive(Debug, Clone, PartialEq)]
enum Token {
    Number(f64),
    StringLit(String),
    CellRef(String),      // e.g. "A1", "$B$3"
    RangeRef(String),     // e.g. "A1:B5"
    Function(String),     // e.g. "SUM", "IF"
    Operator(char),       // +, -, *, /, ^, &
    Compare(String),      // =, <>, <, >, <=, >=
    LParen,
    RParen,
    Comma,
    Colon,
    Bool(bool),
    SheetCellRef { sheet: String, cell: String },   // Sheet1!A1 or 'Sheet Name'!$B$3
    SheetRangeRef { sheet: String, range: String },  // Sheet1!A1:B5
    NamedRef(String),                                // a defined name that is not a cell ref
}

/// AST node for the formula parser
#[derive(Debug, Clone)]
enum Expr {
    Num(f64),
    Str(String),
    Bool(bool),
    CellRef { col: u32, row: u32 },
    RangeRef { col1: u32, row1: u32, col2: u32, row2: u32 },
    BinOp { op: String, left: Box<Expr>, right: Box<Expr> },
    UnaryMinus(Box<Expr>),
    FuncCall { name: String, args: Vec<Expr> },
    SheetCellRef { sheet: String, col: u32, row: u32 },
    SheetRangeRef { sheet: String, col1: u32, row1: u32, col2: u32, row2: u32 },
    NamedRef { name: String },
}

/// Evaluation context: holds all sheets' cell data and the named range table.
struct EvalCtx<'a> {
    /// All sheets' raw cells: sheet_name -> row_key -> col_key -> cell JSON object
    all_sheets: &'a HashMap<String, HashMap<String, HashMap<String, serde_json::Value>>>,
    /// The sheet that contains the formula being evaluated
    active_sheet: &'a str,
    /// Upper-cased name -> formula string (without leading '=')
    named_ranges: &'a HashMap<String, String>,
}

/// Cell value used during evaluation
#[derive(Debug, Clone)]
enum CellValue {
    Number(f64),
    Text(String),
    Bool(bool),
    Error(String),
    Empty,
}

// --- Tokenizer ---

fn tokenize(formula: &str) -> Result<Vec<Token>, String> {
    let chars: Vec<char> = formula.chars().collect();
    let len = chars.len();
    let mut i = 0;
    let mut tokens = Vec::new();

    // Skip leading '='
    if i < len && chars[i] == '=' {
        i += 1;
    }

    while i < len {
        let ch = chars[i];

        // Whitespace
        if ch.is_whitespace() {
            i += 1;
            continue;
        }

        // String literal (double-quoted)
        if ch == '"' {
            i += 1;
            let mut s = String::new();
            while i < len && chars[i] != '"' {
                if chars[i] == '\\' && i + 1 < len {
                    i += 1;
                    s.push(chars[i]);
                } else {
                    s.push(chars[i]);
                }
                i += 1;
            }
            if i < len { i += 1; } // skip closing quote
            tokens.push(Token::StringLit(s));
            continue;
        }

        // Single-quoted sheet name: 'Sheet Name'!CellRef or 'Sheet Name'!A1:B5
        if ch == '\'' {
            i += 1;
            let mut sheet_name = String::new();
            while i < len {
                if chars[i] == '\'' && i + 1 < len && chars[i + 1] == '\'' {
                    // Escaped single quote inside sheet name
                    sheet_name.push('\'');
                    i += 2;
                } else if chars[i] == '\'' {
                    i += 1; // closing quote
                    break;
                } else {
                    sheet_name.push(chars[i]);
                    i += 1;
                }
            }
            if i < len && chars[i] == '!' {
                i += 1;
                let (left_ref, right_ref) = read_cell_or_range(&chars, &mut i, len);
                if let Some(right) = right_ref {
                    tokens.push(Token::SheetRangeRef { sheet: sheet_name, range: format!("{}:{}", left_ref, right) });
                } else if !left_ref.is_empty() {
                    tokens.push(Token::SheetCellRef { sheet: sheet_name, cell: left_ref });
                }
            }
            continue;
        }

        // Number
        if ch.is_ascii_digit() || (ch == '.' && i + 1 < len && chars[i + 1].is_ascii_digit()) {
            let start = i;
            while i < len && (chars[i].is_ascii_digit() || chars[i] == '.') {
                i += 1;
            }
            // Scientific notation
            if i < len && (chars[i] == 'e' || chars[i] == 'E') {
                i += 1;
                if i < len && (chars[i] == '+' || chars[i] == '-') { i += 1; }
                while i < len && chars[i].is_ascii_digit() { i += 1; }
            }
            let num_str: String = chars[start..i].iter().collect();
            let num = num_str.parse::<f64>().map_err(|_| format!("Invalid number: {}", num_str))?;
            tokens.push(Token::Number(num));
            continue;
        }

        // Identifiers: cell refs, range refs, function names, TRUE/FALSE, or SheetName!Ref
        if ch.is_ascii_alphabetic() || ch == '$' || ch == '_' {
            let start = i;
            // Absorb $, letters, digits, underscores
            while i < len && (chars[i].is_ascii_alphanumeric() || chars[i] == '$' || chars[i] == '_') {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();

            // Check for sheet-qualified ref: Word!CellRef or Word!A1:B5
            if i < len && chars[i] == '!' {
                i += 1;
                let (left_ref, right_ref) = read_cell_or_range(&chars, &mut i, len);
                if let Some(right) = right_ref {
                    tokens.push(Token::SheetRangeRef { sheet: word, range: format!("{}:{}", left_ref, right) });
                } else if !left_ref.is_empty() {
                    tokens.push(Token::SheetCellRef { sheet: word, cell: left_ref });
                } else {
                    classify_word(&word, &mut tokens);
                }
                continue;
            }

            // Check for range ref (A1:B5)
            if i < len && chars[i] == ':' {
                let colon_pos = i;
                i += 1;
                let range_start = i;
                while i < len && (chars[i].is_ascii_alphanumeric() || chars[i] == '$') {
                    i += 1;
                }
                if i > range_start {
                    let right: String = chars[range_start..i].iter().collect();
                    tokens.push(Token::RangeRef(format!("{}:{}", word, right)));
                } else {
                    // Not a valid range, push the word and colon separately
                    i = colon_pos;
                    classify_word(&word, &mut tokens);
                }
            } else {
                classify_word(&word, &mut tokens);
            }
            continue;
        }

        // Comparison operators
        if ch == '<' || ch == '>' {
            if i + 1 < len {
                let next = chars[i + 1];
                if ch == '<' && next == '>' { tokens.push(Token::Compare("<>".to_string())); i += 2; continue; }
                if ch == '<' && next == '=' { tokens.push(Token::Compare("<=".to_string())); i += 2; continue; }
                if ch == '>' && next == '=' { tokens.push(Token::Compare(">=".to_string())); i += 2; continue; }
            }
            tokens.push(Token::Compare(ch.to_string()));
            i += 1;
            continue;
        }

        // Single-char tokens
        match ch {
            '+' | '-' | '*' | '/' | '^' | '&' => { tokens.push(Token::Operator(ch)); i += 1; }
            '(' => { tokens.push(Token::LParen); i += 1; }
            ')' => { tokens.push(Token::RParen); i += 1; }
            ',' => { tokens.push(Token::Comma); i += 1; }
            ':' => { tokens.push(Token::Colon); i += 1; }
            '=' => { tokens.push(Token::Compare("=".to_string())); i += 1; }
            _ => { return Err(format!("Unexpected character: {}", ch)); }
        }
    }

    Ok(tokens)
}

fn classify_word(word: &str, tokens: &mut Vec<Token>) {
    let upper = word.to_uppercase();
    match upper.as_str() {
        "TRUE" => tokens.push(Token::Bool(true)),
        "FALSE" => tokens.push(Token::Bool(false)),
        _ => {
            // Check if it looks like a cell ref: letters then digits (with optional $)
            if is_cell_ref(word) {
                tokens.push(Token::CellRef(upper));
            } else {
                // Could be a function name or a named range; the parser decides
                tokens.push(Token::Function(upper));
            }
        }
    }
}

/// Read a cell reference or range reference from chars starting at *i.
/// Returns (left_ref, Some(right_ref)) for ranges, (left_ref, None) for single cells.
fn read_cell_or_range(chars: &[char], i: &mut usize, len: usize) -> (String, Option<String>) {
    let ref_start = *i;
    while *i < len && (chars[*i].is_ascii_alphanumeric() || chars[*i] == '$') {
        *i += 1;
    }
    let left: String = chars[ref_start..*i].iter().collect();
    if *i < len && chars[*i] == ':' {
        *i += 1;
        let range_start = *i;
        while *i < len && (chars[*i].is_ascii_alphanumeric() || chars[*i] == '$') {
            *i += 1;
        }
        let right: String = chars[range_start..*i].iter().collect();
        (left, Some(right))
    } else {
        (left, None)
    }
}

fn is_cell_ref(s: &str) -> bool {
    let clean: String = s.chars().filter(|c| *c != '$').collect();
    if clean.is_empty() { return false; }
    let mut found_digit = false;
    let mut found_alpha = false;
    for ch in clean.chars() {
        if ch.is_ascii_alphabetic() && !found_digit {
            found_alpha = true;
        } else if ch.is_ascii_digit() && found_alpha {
            found_digit = true;
        } else {
            return false;
        }
    }
    found_alpha && found_digit
}

// --- Parser (recursive descent) ---

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Parser { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<Token> {
        if self.pos < self.tokens.len() {
            let t = self.tokens[self.pos].clone();
            self.pos += 1;
            Some(t)
        } else {
            None
        }
    }

    fn parse(&mut self) -> Result<Expr, String> {
        let expr = self.parse_comparison()?;
        if self.pos < self.tokens.len() {
            return Err(format!("Unexpected token at position {}", self.pos));
        }
        Ok(expr)
    }

    fn parse_comparison(&mut self) -> Result<Expr, String> {
        let left = self.parse_concat()?;
        if let Some(Token::Compare(op)) = self.peek().cloned() {
            self.advance();
            let right = self.parse_concat()?;
            return Ok(Expr::BinOp { op, left: Box::new(left), right: Box::new(right) });
        }
        Ok(left)
    }

    fn parse_concat(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_additive()?;
        while let Some(Token::Operator('&')) = self.peek() {
            self.advance();
            let right = self.parse_additive()?;
            left = Expr::BinOp { op: "&".to_string(), left: Box::new(left), right: Box::new(right) };
        }
        Ok(left)
    }

    fn parse_additive(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_multiplicative()?;
        loop {
            match self.peek() {
                Some(Token::Operator('+')) => {
                    self.advance();
                    let right = self.parse_multiplicative()?;
                    left = Expr::BinOp { op: "+".to_string(), left: Box::new(left), right: Box::new(right) };
                }
                Some(Token::Operator('-')) => {
                    self.advance();
                    let right = self.parse_multiplicative()?;
                    left = Expr::BinOp { op: "-".to_string(), left: Box::new(left), right: Box::new(right) };
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_multiplicative(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_power()?;
        loop {
            match self.peek() {
                Some(Token::Operator('*')) => {
                    self.advance();
                    let right = self.parse_power()?;
                    left = Expr::BinOp { op: "*".to_string(), left: Box::new(left), right: Box::new(right) };
                }
                Some(Token::Operator('/')) => {
                    self.advance();
                    let right = self.parse_power()?;
                    left = Expr::BinOp { op: "/".to_string(), left: Box::new(left), right: Box::new(right) };
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_power(&mut self) -> Result<Expr, String> {
        let base = self.parse_unary()?;
        if let Some(Token::Operator('^')) = self.peek() {
            self.advance();
            let exp = self.parse_unary()?;
            return Ok(Expr::BinOp { op: "^".to_string(), left: Box::new(base), right: Box::new(exp) });
        }
        Ok(base)
    }

    fn parse_unary(&mut self) -> Result<Expr, String> {
        if let Some(Token::Operator('-')) = self.peek() {
            self.advance();
            let expr = self.parse_primary()?;
            return Ok(Expr::UnaryMinus(Box::new(expr)));
        }
        if let Some(Token::Operator('+')) = self.peek() {
            self.advance();
            return self.parse_primary();
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<Expr, String> {
        match self.peek().cloned() {
            Some(Token::Number(n)) => {
                self.advance();
                Ok(Expr::Num(n))
            }
            Some(Token::StringLit(s)) => {
                self.advance();
                Ok(Expr::Str(s))
            }
            Some(Token::Bool(b)) => {
                self.advance();
                Ok(Expr::Bool(b))
            }
            Some(Token::Function(name)) => {
                self.advance();
                // If followed by '(' it's a function call; otherwise it's a named range ref
                if !matches!(self.peek(), Some(Token::LParen)) {
                    return Ok(Expr::NamedRef { name });
                }
                self.advance(); // consume '('
                let mut args = Vec::new();
                if !matches!(self.peek(), Some(Token::RParen)) {
                    args.push(self.parse_comparison()?);
                    while matches!(self.peek(), Some(Token::Comma)) {
                        self.advance();
                        args.push(self.parse_comparison()?);
                    }
                }
                if !matches!(self.peek(), Some(Token::RParen)) {
                    return Err(format!("Expected ')' after function {} arguments", name));
                }
                self.advance(); // consume ')'
                Ok(Expr::FuncCall { name, args })
            }
            Some(Token::RangeRef(r)) => {
                self.advance();
                let parts: Vec<&str> = r.split(':').collect();
                if parts.len() == 2 {
                    let (r1, c1) = parse_cell_ref_str(parts[0]);
                    let (r2, c2) = parse_cell_ref_str(parts[1]);
                    Ok(Expr::RangeRef { col1: c1, row1: r1, col2: c2, row2: r2 })
                } else {
                    Err(format!("Invalid range: {}", r))
                }
            }
            Some(Token::CellRef(r)) => {
                self.advance();
                let (row, col) = parse_cell_ref_str(&r);
                Ok(Expr::CellRef { col, row })
            }
            Some(Token::SheetCellRef { sheet, cell }) => {
                self.advance();
                let (row, col) = parse_cell_ref_str(&cell);
                Ok(Expr::SheetCellRef { sheet, col, row })
            }
            Some(Token::SheetRangeRef { sheet, range }) => {
                self.advance();
                let parts: Vec<&str> = range.split(':').collect();
                if parts.len() == 2 {
                    let (r1, c1) = parse_cell_ref_str(parts[0]);
                    let (r2, c2) = parse_cell_ref_str(parts[1]);
                    Ok(Expr::SheetRangeRef { sheet, col1: c1, row1: r1, col2: c2, row2: r2 })
                } else {
                    Err(format!("Invalid sheet range: {}", range))
                }
            }
            Some(Token::NamedRef(name)) => {
                self.advance();
                Ok(Expr::NamedRef { name })
            }
            Some(Token::LParen) => {
                self.advance();
                let expr = self.parse_comparison()?;
                if !matches!(self.peek(), Some(Token::RParen)) {
                    return Err("Expected ')'".to_string());
                }
                self.advance();
                Ok(expr)
            }
            _ => Err("Unexpected end of formula".to_string()),
        }
    }
}

fn parse_cell_ref_str(s: &str) -> (u32, u32) {
    let clean: String = s.chars().filter(|c| *c != '$').collect();
    let mut col: u32 = 0;
    let mut row: u32 = 0;
    let mut in_digits = false;

    for ch in clean.chars() {
        if ch.is_ascii_alphabetic() && !in_digits {
            col = col * 26 + (ch.to_ascii_uppercase() as u32 - 'A' as u32 + 1);
        } else if ch.is_ascii_digit() {
            in_digits = true;
            row = row * 10 + (ch as u32 - '0' as u32);
        }
    }
    (row.saturating_sub(1), col.saturating_sub(1))
}

// --- Evaluator ---

fn evaluate(
    expr: &Expr,
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    match expr {
        Expr::Num(n) => CellValue::Number(*n),
        Expr::Str(s) => CellValue::Text(s.clone()),
        Expr::Bool(b) => CellValue::Bool(*b),
        Expr::CellRef { col, row } => {
            get_cell_value(*row, *col, ctx.active_sheet, ctx, visited, formula_cache)
        }
        Expr::SheetCellRef { sheet, col, row } => {
            get_cell_value(*row, *col, sheet, ctx, visited, formula_cache)
        }
        Expr::RangeRef { .. } | Expr::SheetRangeRef { .. } => {
            // Range refs should only appear as function arguments; evaluated inline by functions
            CellValue::Error("#VALUE!".to_string())
        }
        Expr::NamedRef { name } => {
            eval_named_ref(name, ctx, visited, formula_cache)
        }
        Expr::UnaryMinus(inner) => {
            match evaluate(inner, ctx, visited, formula_cache) {
                CellValue::Number(n) => CellValue::Number(-n),
                CellValue::Empty => CellValue::Number(0.0),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        Expr::BinOp { op, left, right } => {
            eval_binop(op, left, right, ctx, visited, formula_cache)
        }
        Expr::FuncCall { name, args } => {
            eval_function(name, args, ctx, visited, formula_cache)
        }
    }
}

/// Resolve a named range reference and evaluate it.
/// Named ranges that point to a cell or range return the cell value (or error for multi-cell).
fn eval_named_ref(
    name: &str,
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    let upper = name.to_uppercase();
    let formula = match ctx.named_ranges.get(&upper) {
        Some(f) => f.clone(),
        None => return CellValue::Error(format!("#NAME? ({})", name)),
    };

    // Evaluate the named range's formula in its own context
    let formula_with_eq = if formula.starts_with('=') { formula.clone() } else { format!("={}", formula) };

    // Guard against circular named range references
    let cycle_key = format!("_named_:{}", upper);
    if visited.contains(&cycle_key) {
        return CellValue::Error("#CIRC!".to_string());
    }
    visited.insert(cycle_key.clone());

    let result = match tokenize(&formula_with_eq).and_then(|tokens| {
        let mut parser = Parser::new(tokens);
        parser.parse()
    }) {
        Ok(expr) => evaluate(&expr, ctx, visited, formula_cache),
        Err(_) => CellValue::Error("#REF!".to_string()),
    };

    visited.remove(&cycle_key);
    result
}

fn eval_binop(
    op: &str,
    left: &Expr,
    right: &Expr,
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    let lv = evaluate(left, ctx, visited, formula_cache);
    let rv = evaluate(right, ctx, visited, formula_cache);

    if op == "&" {
        // String concatenation
        return CellValue::Text(format!("{}{}", cv_to_string(&lv), cv_to_string(&rv)));
    }

    // Comparison operators
    if ["=", "<>", "<", ">", "<=", ">="].contains(&op) {
        let ln = cv_to_number(&lv);
        let rn = cv_to_number(&rv);
        if let (Some(a), Some(b)) = (ln, rn) {
            let result = match op {
                "=" => (a - b).abs() < 1e-10,
                "<>" => (a - b).abs() >= 1e-10,
                "<" => a < b,
                ">" => a > b,
                "<=" => a <= b,
                ">=" => a >= b,
                _ => false,
            };
            return CellValue::Bool(result);
        }
        // String comparison fallback
        let ls = cv_to_string(&lv);
        let rs = cv_to_string(&rv);
        let result = match op {
            "=" => ls == rs,
            "<>" => ls != rs,
            "<" => ls < rs,
            ">" => ls > rs,
            "<=" => ls <= rs,
            ">=" => ls >= rs,
            _ => false,
        };
        return CellValue::Bool(result);
    }

    // Arithmetic operators
    let ln = cv_to_number_or_zero(&lv);
    let rn = cv_to_number_or_zero(&rv);
    match op {
        "+" => CellValue::Number(ln + rn),
        "-" => CellValue::Number(ln - rn),
        "*" => CellValue::Number(ln * rn),
        "/" => {
            if rn.abs() < 1e-15 {
                CellValue::Error("#DIV/0!".to_string())
            } else {
                CellValue::Number(ln / rn)
            }
        }
        "^" => CellValue::Number(ln.powf(rn)),
        _ => CellValue::Error("#VALUE!".to_string()),
    }
}

fn eval_function(
    name: &str,
    args: &[Expr],
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    match name {
        "SUM" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let sum: f64 = values.iter().filter_map(|v| cv_to_number(v)).sum();
            CellValue::Number(sum)
        }
        "AVERAGE" | "AVG" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() {
                CellValue::Error("#DIV/0!".to_string())
            } else {
                CellValue::Number(nums.iter().sum::<f64>() / nums.len() as f64)
            }
        }
        "COUNT" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let count = values.iter().filter(|v| cv_to_number(v).is_some()).count();
            CellValue::Number(count as f64)
        }
        "COUNTA" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let count = values.iter().filter(|v| !matches!(v, CellValue::Empty)).count();
            CellValue::Number(count as f64)
        }
        "MIN" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() {
                CellValue::Number(0.0)
            } else {
                CellValue::Number(nums.iter().cloned().fold(f64::INFINITY, f64::min))
            }
        }
        "MAX" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() {
                CellValue::Number(0.0)
            } else {
                CellValue::Number(nums.iter().cloned().fold(f64::NEG_INFINITY, f64::max))
            }
        }
        "IF" => {
            if args.is_empty() {
                return CellValue::Error("#VALUE!".to_string());
            }
            let cond = evaluate(&args[0], ctx, visited, formula_cache);
            let is_true = match cond {
                CellValue::Bool(b) => b,
                CellValue::Number(n) => n != 0.0,
                _ => false,
            };
            if is_true {
                if args.len() > 1 {
                    evaluate(&args[1], ctx, visited, formula_cache)
                } else {
                    CellValue::Bool(true)
                }
            } else if args.len() > 2 {
                evaluate(&args[2], ctx, visited, formula_cache)
            } else {
                CellValue::Bool(false)
            }
        }
        "VLOOKUP" => {
            // VLOOKUP(lookup_value, table_range, col_index_num, [range_lookup])
            if args.len() < 3 {
                return CellValue::Error("#VALUE!".to_string());
            }
            let lookup_val = evaluate(&args[0], ctx, visited, formula_cache);
            let col_index = match evaluate(&args[2], ctx, visited, formula_cache) {
                CellValue::Number(n) => n as u32,
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            if col_index == 0 {
                return CellValue::Error("#VALUE!".to_string());
            }

            // Support both same-sheet and cross-sheet ranges
            let (sheet_for_lookup, col1, row1, col2) = match &args[1] {
                Expr::RangeRef { col1, row1, col2, row2: _ } => {
                    (ctx.active_sheet.to_string(), *col1, *row1, *col2)
                }
                Expr::SheetRangeRef { sheet, col1, row1, col2, row2: _ } => {
                    (sheet.clone(), *col1, *row1, *col2)
                }
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            let row2 = match &args[1] {
                Expr::RangeRef { row2, .. } | Expr::SheetRangeRef { row2, .. } => *row2,
                _ => return CellValue::Error("#VALUE!".to_string()),
            };

            if col_index > (col2 - col1 + 1) {
                return CellValue::Error("#REF!".to_string());
            }
            let target_col = col1 + col_index - 1;
            let lookup_str = cv_to_string(&lookup_val);
            let lookup_num = cv_to_number(&lookup_val);

            for r in row1..=row2 {
                let cell_val = get_cell_value(r, col1, &sheet_for_lookup, ctx, visited, formula_cache);
                let is_match = if let Some(ln) = lookup_num {
                    if let Some(cn) = cv_to_number(&cell_val) {
                        (ln - cn).abs() < 1e-10
                    } else {
                        false
                    }
                } else {
                    cv_to_string(&cell_val).to_uppercase() == lookup_str.to_uppercase()
                };
                if is_match {
                    return get_cell_value(r, target_col, &sheet_for_lookup, ctx, visited, formula_cache);
                }
            }
            CellValue::Error("#N/A".to_string())
        }
        "ABS" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            match evaluate(&args[0], ctx, visited, formula_cache) {
                CellValue::Number(n) => CellValue::Number(n.abs()),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "ROUND" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let digits = if args.len() > 1 {
                cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32
            } else { 0 };
            let factor = 10f64.powi(digits);
            CellValue::Number((n * factor).round() / factor)
        }
        "LEN" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            CellValue::Number(s.len() as f64)
        }
        "UPPER" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            CellValue::Text(s.to_uppercase())
        }
        "LOWER" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            CellValue::Text(s.to_lowercase())
        }
        "CONCATENATE" | "CONCAT" => {
            let mut result = String::new();
            for arg in args {
                let v = evaluate(arg, ctx, visited, formula_cache);
                result.push_str(&cv_to_string(&v));
            }
            CellValue::Text(result)
        }
        "NOT" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            match evaluate(&args[0], ctx, visited, formula_cache) {
                CellValue::Bool(b) => CellValue::Bool(!b),
                CellValue::Number(n) => CellValue::Bool(n == 0.0),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "AND" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let result = values.iter().all(|v| match v {
                CellValue::Bool(b) => *b,
                CellValue::Number(n) => *n != 0.0,
                _ => false,
            });
            CellValue::Bool(result)
        }
        "OR" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let result = values.iter().any(|v| match v {
                CellValue::Bool(b) => *b,
                CellValue::Number(n) => *n != 0.0,
                _ => false,
            });
            CellValue::Bool(result)
        }
        // ─── Math / Trig ──────────────────────────────────────────────────────────
        "PRODUCT" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let product = values.iter().filter_map(|v| cv_to_number(v)).fold(1.0_f64, |acc, x| acc * x);
            CellValue::Number(product)
        }
        "MOD" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let d = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            if d == 0.0 { return CellValue::Error("#DIV/0!".to_string()); }
            CellValue::Number(n - d * (n / d).floor())
        }
        "INT" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            CellValue::Number(n.floor())
        }
        "CEILING" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let sig = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) } else { 1.0 };
            if sig == 0.0 { return CellValue::Number(0.0); }
            CellValue::Number((n / sig).ceil() * sig)
        }
        "FLOOR" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let sig = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) } else { 1.0 };
            if sig == 0.0 { return CellValue::Number(0.0); }
            CellValue::Number((n / sig).floor() * sig)
        }
        "POWER" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let base = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let exp = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            CellValue::Number(base.powf(exp))
        }
        "SQRT" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            if n < 0.0 { return CellValue::Error("#NUM!".to_string()); }
            CellValue::Number(n.sqrt())
        }
        "LOG" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let base = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) } else { 10.0 };
            if n <= 0.0 || base <= 0.0 || base == 1.0 { return CellValue::Error("#NUM!".to_string()); }
            CellValue::Number(n.ln() / base.ln())
        }
        "LOG10" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            if n <= 0.0 { return CellValue::Error("#NUM!".to_string()); }
            CellValue::Number(n.log10())
        }
        "LN" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            if n <= 0.0 { return CellValue::Error("#NUM!".to_string()); }
            CellValue::Number(n.ln())
        }
        "EXP" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            CellValue::Number(n.exp())
        }
        "PI" => CellValue::Number(std::f64::consts::PI),
        "RAND" => {
            // Simple LCG pseudo-random in WASM (no std::random)
            let ts = JsDate::now() as u64;
            let r = ((ts.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)) >> 33) as f64
                / (u32::MAX as f64);
            CellValue::Number(r.abs().min(0.9999999))
        }
        "RANDBETWEEN" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let lo = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)).floor() as i64;
            let hi = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)).floor() as i64;
            if lo > hi { return CellValue::Error("#NUM!".to_string()); }
            let ts = JsDate::now() as u64;
            let r = ((ts.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)) >> 33) as u64;
            let range = (hi - lo + 1) as u64;
            CellValue::Number((lo + (r % range) as i64) as f64)
        }
        "SIGN" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            CellValue::Number(if n > 0.0 { 1.0 } else if n < 0.0 { -1.0 } else { 0.0 })
        }
        "TRUNC" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let digits = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32 } else { 0 };
            let factor = 10f64.powi(digits);
            CellValue::Number((n * factor).trunc() / factor)
        }
        "SUMPRODUCT" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let arrays: Vec<Vec<CellValue>> = args.iter().map(|a| {
                let triples = eval_range_to_vec(a, ctx, visited, formula_cache);
                triples.into_iter().map(|(_, _, v)| v).collect()
            }).collect();
            let len = arrays[0].len();
            let mut sum = 0.0_f64;
            for i in 0..len {
                let product = arrays.iter().fold(1.0_f64, |acc, arr| {
                    acc * cv_to_number(arr.get(i).unwrap_or(&CellValue::Number(0.0))).unwrap_or(0.0)
                });
                sum += product;
            }
            CellValue::Number(sum)
        }
        "SUMIF" => {
            // SUMIF(range, criteria, [sum_range])
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let range_vals = eval_range_to_vec(&args[0], ctx, visited, formula_cache);
            let criteria_val = evaluate(&args[1], ctx, visited, formula_cache);
            let sum_vals = if args.len() > 2 {
                eval_range_to_vec(&args[2], ctx, visited, formula_cache)
            } else {
                range_vals.clone()
            };
            let mut sum = 0.0_f64;
            for (i, (_, _, v)) in range_vals.iter().enumerate() {
                if matches_criteria(v, &criteria_val) {
                    if let Some(sv) = sum_vals.get(i) {
                        sum += cv_to_number(&sv.2).unwrap_or(0.0);
                    }
                }
            }
            CellValue::Number(sum)
        }
        "SUMIFS" => {
            // SUMIFS(sum_range, criteria_range1, criteria1, [range2, crit2, ...])
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let sum_vals = eval_range_to_vec(&args[0], ctx, visited, formula_cache);
            let num_pairs = (args.len() - 1) / 2;
            let mut sum = 0.0_f64;
            for (i, sv) in sum_vals.iter().enumerate() {
                let mut all_match = true;
                for p in 0..num_pairs {
                    let crit_range = eval_range_to_vec(&args[1 + p * 2], ctx, visited, formula_cache);
                    let crit_val = evaluate(&args[2 + p * 2], ctx, visited, formula_cache);
                    let cell_val = crit_range.get(i).map(|t| &t.2).unwrap_or(&CellValue::Empty);
                    if !matches_criteria(cell_val, &crit_val) { all_match = false; break; }
                }
                if all_match { sum += cv_to_number(&sv.2).unwrap_or(0.0); }
            }
            CellValue::Number(sum)
        }

        // ─── Statistical ──────────────────────────────────────────────────────────
        "COUNTIF" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let range_vals = eval_range_to_vec(&args[0], ctx, visited, formula_cache);
            let criteria_val = evaluate(&args[1], ctx, visited, formula_cache);
            let count = range_vals.iter().filter(|(_, _, v)| matches_criteria(v, &criteria_val)).count();
            CellValue::Number(count as f64)
        }
        "COUNTIFS" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let num_pairs = args.len() / 2;
            let first_range = eval_range_to_vec(&args[0], ctx, visited, formula_cache);
            let mut count = 0usize;
            for i in 0..first_range.len() {
                let mut all_match = true;
                for p in 0..num_pairs {
                    let crit_range = eval_range_to_vec(&args[p * 2], ctx, visited, formula_cache);
                    let crit_val = evaluate(&args[p * 2 + 1], ctx, visited, formula_cache);
                    let cell_val = crit_range.get(i).map(|t| &t.2).unwrap_or(&CellValue::Empty);
                    if !matches_criteria(cell_val, &crit_val) { all_match = false; break; }
                }
                if all_match { count += 1; }
            }
            CellValue::Number(count as f64)
        }
        "AVERAGEIF" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let range_vals = eval_range_to_vec(&args[0], ctx, visited, formula_cache);
            let criteria_val = evaluate(&args[1], ctx, visited, formula_cache);
            let avg_vals = if args.len() > 2 {
                eval_range_to_vec(&args[2], ctx, visited, formula_cache)
            } else {
                range_vals.clone()
            };
            let mut sum = 0.0_f64;
            let mut count = 0usize;
            for (i, (_, _, v)) in range_vals.iter().enumerate() {
                if matches_criteria(v, &criteria_val) {
                    if let Some(sv) = avg_vals.get(i) {
                        if let Some(n) = cv_to_number(&sv.2) { sum += n; count += 1; }
                    }
                }
            }
            if count == 0 { CellValue::Error("#DIV/0!".to_string()) } else { CellValue::Number(sum / count as f64) }
        }
        "AVERAGEIFS" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let avg_vals = eval_range_to_vec(&args[0], ctx, visited, formula_cache);
            let num_pairs = (args.len() - 1) / 2;
            let mut sum = 0.0_f64;
            let mut count = 0usize;
            for (i, av) in avg_vals.iter().enumerate() {
                let mut all_match = true;
                for p in 0..num_pairs {
                    let crit_range = eval_range_to_vec(&args[1 + p * 2], ctx, visited, formula_cache);
                    let crit_val = evaluate(&args[2 + p * 2], ctx, visited, formula_cache);
                    let cell_val = crit_range.get(i).map(|t| &t.2).unwrap_or(&CellValue::Empty);
                    if !matches_criteria(cell_val, &crit_val) { all_match = false; break; }
                }
                if all_match {
                    if let Some(n) = cv_to_number(&av.2) { sum += n; count += 1; }
                }
            }
            if count == 0 { CellValue::Error("#DIV/0!".to_string()) } else { CellValue::Number(sum / count as f64) }
        }
        "MEDIAN" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let mut nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() { return CellValue::Error("#NUM!".to_string()); }
            nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let mid = nums.len() / 2;
            let median = if nums.len() % 2 == 0 { (nums[mid - 1] + nums[mid]) / 2.0 } else { nums[mid] };
            CellValue::Number(median)
        }
        "MODE" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<i64> = values.iter().filter_map(|v| cv_to_number(v)).map(|n| (n * 1e10).round() as i64).collect();
            if nums.is_empty() { return CellValue::Error("#N/A".to_string()); }
            let mut freq: HashMap<i64, usize> = HashMap::new();
            for n in &nums { *freq.entry(*n).or_insert(0) += 1; }
            let max_freq = freq.values().cloned().max().unwrap_or(0);
            let mode_key = freq.into_iter().filter(|(_, c)| *c == max_freq).map(|(k, _)| k).next().unwrap_or(0);
            CellValue::Number(mode_key as f64 / 1e10)
        }
        "STDEV" | "STDEV.S" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.len() < 2 { return CellValue::Error("#DIV/0!".to_string()); }
            let mean = nums.iter().sum::<f64>() / nums.len() as f64;
            let variance = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (nums.len() - 1) as f64;
            CellValue::Number(variance.sqrt())
        }
        "STDEVP" | "STDEV.P" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() { return CellValue::Error("#DIV/0!".to_string()); }
            let mean = nums.iter().sum::<f64>() / nums.len() as f64;
            let variance = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / nums.len() as f64;
            CellValue::Number(variance.sqrt())
        }
        "VAR" | "VAR.S" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.len() < 2 { return CellValue::Error("#DIV/0!".to_string()); }
            let mean = nums.iter().sum::<f64>() / nums.len() as f64;
            let variance = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (nums.len() - 1) as f64;
            CellValue::Number(variance)
        }
        "VARP" | "VAR.P" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() { return CellValue::Error("#DIV/0!".to_string()); }
            let mean = nums.iter().sum::<f64>() / nums.len() as f64;
            let variance = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / nums.len() as f64;
            CellValue::Number(variance)
        }
        "LARGE" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let values = flatten_args(&args[..1], ctx, visited, formula_cache);
            let k = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize;
            let mut nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if k == 0 || k > nums.len() { return CellValue::Error("#NUM!".to_string()); }
            nums.sort_by(|a, b| b.partial_cmp(a).unwrap());
            CellValue::Number(nums[k - 1])
        }
        "SMALL" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let values = flatten_args(&args[..1], ctx, visited, formula_cache);
            let k = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize;
            let mut nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if k == 0 || k > nums.len() { return CellValue::Error("#NUM!".to_string()); }
            nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
            CellValue::Number(nums[k - 1])
        }
        "RANK" | "RANK.EQ" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let number = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let values = flatten_args(&args[1..2], ctx, visited, formula_cache);
            let order = if args.len() > 2 { cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as i32 } else { 0 };
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            let rank = if order == 0 {
                nums.iter().filter(|&&x| x > number).count() + 1
            } else {
                nums.iter().filter(|&&x| x < number).count() + 1
            };
            CellValue::Number(rank as f64)
        }
        "PERCENTILE" | "PERCENTILE.INC" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let values = flatten_args(&args[..1], ctx, visited, formula_cache);
            let k = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let mut nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() || k < 0.0 || k > 1.0 { return CellValue::Error("#NUM!".to_string()); }
            nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let idx = k * (nums.len() - 1) as f64;
            let lo = idx.floor() as usize;
            let hi = idx.ceil() as usize;
            let frac = idx.fract();
            CellValue::Number(nums[lo] + frac * (nums[hi] - nums[lo]))
        }
        "QUARTILE" | "QUARTILE.INC" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let values = flatten_args(&args[..1], ctx, visited, formula_cache);
            let q = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as u32;
            let mut nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() || q > 4 { return CellValue::Error("#NUM!".to_string()); }
            nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let k = q as f64 / 4.0;
            let idx = k * (nums.len() - 1) as f64;
            let lo = idx.floor() as usize;
            let hi = (idx.ceil() as usize).min(nums.len() - 1);
            let frac = idx.fract();
            CellValue::Number(nums[lo] + frac * (nums[hi] - nums[lo]))
        }

        // ─── Lookup ───────────────────────────────────────────────────────────────
        "HLOOKUP" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let lookup_val = evaluate(&args[0], ctx, visited, formula_cache);
            let row_index = match evaluate(&args[2], ctx, visited, formula_cache) {
                CellValue::Number(n) => n as u32,
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            if row_index == 0 { return CellValue::Error("#VALUE!".to_string()); }
            let (sheet_for_lookup, col1, row1, col2) = match &args[1] {
                Expr::RangeRef { col1, row1, col2, row2: _ } => (ctx.active_sheet.to_string(), *col1, *row1, *col2),
                Expr::SheetRangeRef { sheet, col1, row1, col2, row2: _ } => (sheet.clone(), *col1, *row1, *col2),
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            let row2 = match &args[1] {
                Expr::RangeRef { row2, .. } | Expr::SheetRangeRef { row2, .. } => *row2,
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            if row_index > (row2 - row1 + 1) { return CellValue::Error("#REF!".to_string()); }
            let target_row = row1 + row_index - 1;
            let lookup_str = cv_to_string(&lookup_val);
            let lookup_num = cv_to_number(&lookup_val);
            for c in col1..=col2 {
                let cell_val = get_cell_value(row1, c, &sheet_for_lookup, ctx, visited, formula_cache);
                let is_match = if let Some(ln) = lookup_num {
                    cv_to_number(&cell_val).map(|cn| (ln - cn).abs() < 1e-10).unwrap_or(false)
                } else {
                    cv_to_string(&cell_val).to_uppercase() == lookup_str.to_uppercase()
                };
                if is_match {
                    return get_cell_value(target_row, c, &sheet_for_lookup, ctx, visited, formula_cache);
                }
            }
            CellValue::Error("#N/A".to_string())
        }
        "MATCH" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let lookup_val = evaluate(&args[0], ctx, visited, formula_cache);
            let match_type = if args.len() > 2 { cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as i32 } else { 1 };
            let items = eval_range_to_vec(&args[1], ctx, visited, formula_cache);
            let lookup_str = cv_to_string(&lookup_val).to_uppercase();
            let lookup_num = cv_to_number(&lookup_val);
            for (i, (_, _, v)) in items.iter().enumerate() {
                let is_match = if match_type == 0 {
                    // Exact match with wildcard support
                    if let Some(ln) = lookup_num {
                        cv_to_number(v).map(|cn| (ln - cn).abs() < 1e-10).unwrap_or(false)
                    } else {
                        wildcard_match(&cv_to_string(v).to_uppercase(), &lookup_str)
                    }
                } else {
                    if let Some(ln) = lookup_num {
                        cv_to_number(v).map(|cn| (ln - cn).abs() < 1e-10).unwrap_or(false)
                    } else {
                        cv_to_string(v).to_uppercase() == lookup_str
                    }
                };
                if is_match { return CellValue::Number((i + 1) as f64); }
            }
            CellValue::Error("#N/A".to_string())
        }
        "INDEX" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let row_num = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as u32;
            let col_num = if args.len() > 2 { cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as u32 } else { 1 };
            match &args[0] {
                Expr::RangeRef { col1, row1, col2, row2 } => {
                    let target_row = if row_num == 0 { *row1 } else { row1 + row_num - 1 };
                    let target_col = if col_num == 0 { *col1 } else { col1 + col_num - 1 };
                    if target_row > *row2 || target_col > *col2 { return CellValue::Error("#REF!".to_string()); }
                    get_cell_value(target_row, target_col, ctx.active_sheet, ctx, visited, formula_cache)
                }
                Expr::SheetRangeRef { sheet, col1, row1, col2, row2 } => {
                    let target_row = if row_num == 0 { *row1 } else { row1 + row_num - 1 };
                    let target_col = if col_num == 0 { *col1 } else { col1 + col_num - 1 };
                    if target_row > *row2 || target_col > *col2 { return CellValue::Error("#REF!".to_string()); }
                    get_cell_value(target_row, target_col, sheet, ctx, visited, formula_cache)
                }
                _ => {
                    if row_num <= 1 && col_num <= 1 { evaluate(&args[0], ctx, visited, formula_cache) }
                    else { CellValue::Error("#REF!".to_string()) }
                }
            }
        }
        "XLOOKUP" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let lookup_val = evaluate(&args[0], ctx, visited, formula_cache);
            let lookup_arr = eval_range_to_vec(&args[1], ctx, visited, formula_cache);
            let return_arr = eval_range_to_vec(&args[2], ctx, visited, formula_cache);
            let not_found = if args.len() > 3 { Some(evaluate(&args[3], ctx, visited, formula_cache)) } else { None };
            let match_mode = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) as i32 } else { 0 };
            let lookup_str = cv_to_string(&lookup_val).to_uppercase();
            let lookup_num = cv_to_number(&lookup_val);
            for (i, (_, _, v)) in lookup_arr.iter().enumerate() {
                let is_match = match match_mode {
                    0 => {
                        if let Some(ln) = lookup_num {
                            cv_to_number(v).map(|cn| (ln - cn).abs() < 1e-10).unwrap_or(false)
                        } else {
                            wildcard_match(&cv_to_string(v).to_uppercase(), &lookup_str)
                        }
                    }
                    _ => {
                        if let Some(ln) = lookup_num {
                            cv_to_number(v).map(|cn| (ln - cn).abs() < 1e-10).unwrap_or(false)
                        } else {
                            cv_to_string(v).to_uppercase() == lookup_str
                        }
                    }
                };
                if is_match {
                    return return_arr.get(i).map(|t| t.2.clone()).unwrap_or(CellValue::Error("#N/A".to_string()));
                }
            }
            not_found.unwrap_or(CellValue::Error("#N/A".to_string()))
        }
        "CHOOSE" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let idx = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)) as usize;
            if idx == 0 || idx >= args.len() { return CellValue::Error("#VALUE!".to_string()); }
            evaluate(&args[idx], ctx, visited, formula_cache)
        }
        "INDIRECT" => {
            if args.is_empty() { return CellValue::Error("#REF!".to_string()); }
            let ref_str = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            match parse_indirect_ref(&ref_str) {
                Some((row, col)) => get_cell_value(row, col, ctx.active_sheet, ctx, visited, formula_cache),
                None => CellValue::Error("#REF!".to_string()),
            }
        }
        "OFFSET" => {
            // OFFSET(reference, rows, cols, [height], [width]) - returns value of offset cell
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let (base_row, base_col) = match &args[0] {
                Expr::CellRef { col, row } => (*row, *col),
                Expr::SheetCellRef { col, row, .. } => (*row, *col),
                Expr::RangeRef { row1, col1, .. } => (*row1, *col1),
                Expr::SheetRangeRef { row1, col1, .. } => (*row1, *col1),
                _ => return CellValue::Error("#REF!".to_string()),
            };
            let row_off = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i64;
            let col_off = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as i64;
            let target_row = (base_row as i64 + row_off) as u32;
            let target_col = (base_col as i64 + col_off) as u32;
            get_cell_value(target_row, target_col, ctx.active_sheet, ctx, visited, formula_cache)
        }
        "ROW" => {
            if args.is_empty() { return CellValue::Number(1.0); }
            match &args[0] {
                Expr::CellRef { row, .. } | Expr::SheetCellRef { row, .. } => CellValue::Number((*row + 1) as f64),
                Expr::RangeRef { row1, .. } | Expr::SheetRangeRef { row1, .. } => CellValue::Number((*row1 + 1) as f64),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "COLUMN" => {
            if args.is_empty() { return CellValue::Number(1.0); }
            match &args[0] {
                Expr::CellRef { col, .. } | Expr::SheetCellRef { col, .. } => CellValue::Number((*col + 1) as f64),
                Expr::RangeRef { col1, .. } | Expr::SheetRangeRef { col1, .. } => CellValue::Number((*col1 + 1) as f64),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "ROWS" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            match &args[0] {
                Expr::RangeRef { row1, row2, .. } | Expr::SheetRangeRef { row1, row2, .. } => CellValue::Number((row2 - row1 + 1) as f64),
                _ => CellValue::Number(1.0),
            }
        }
        "COLUMNS" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            match &args[0] {
                Expr::RangeRef { col1, col2, .. } | Expr::SheetRangeRef { col1, col2, .. } => CellValue::Number((col2 - col1 + 1) as f64),
                _ => CellValue::Number(1.0),
            }
        }

        // ─── Text ─────────────────────────────────────────────────────────────────
        "LEFT" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let n = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize } else { 1 };
            CellValue::Text(s.chars().take(n).collect())
        }
        "RIGHT" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let n = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize } else { 1 };
            let chars: Vec<char> = s.chars().collect();
            let start = chars.len().saturating_sub(n);
            CellValue::Text(chars[start..].iter().collect())
        }
        "MID" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let start = (cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize).saturating_sub(1);
            let len = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as usize;
            CellValue::Text(s.chars().skip(start).take(len).collect())
        }
        "FIND" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let find_str = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let within = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache));
            let start = if args.len() > 2 { (cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as usize).saturating_sub(1) } else { 0 };
            let within_from: String = within.chars().skip(start).collect();
            match within_from.find(&find_str) {
                Some(pos) => CellValue::Number((start + pos + 1) as f64),
                None => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "SEARCH" => {
            // Like FIND but case-insensitive and supports wildcards
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let find_str = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache)).to_uppercase();
            let within = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache)).to_uppercase();
            let start = if args.len() > 2 { (cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as usize).saturating_sub(1) } else { 0 };
            let chars: Vec<char> = within.chars().collect();
            let find_chars: Vec<char> = find_str.chars().collect();
            for i in start..chars.len() {
                if wildcard_match_inner(&chars[i..], &find_chars, 0, 0) {
                    return CellValue::Number((i + 1) as f64);
                }
            }
            CellValue::Error("#VALUE!".to_string())
        }
        "SUBSTITUTE" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let text = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let old_str = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache));
            let new_str = cv_to_string(&evaluate(&args[2], ctx, visited, formula_cache));
            let instance = if args.len() > 3 { Some(cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache)) as usize) } else { None };
            if old_str.is_empty() { return CellValue::Text(text); }
            match instance {
                None => CellValue::Text(text.replace(&old_str, &new_str)),
                Some(n) => {
                    let mut result = text.clone();
                    let mut count = 0usize;
                    let mut search_from = 0;
                    while let Some(pos) = result[search_from..].find(&old_str) {
                        let abs_pos = search_from + pos;
                        count += 1;
                        if count == n {
                            result = format!("{}{}{}", &result[..abs_pos], new_str, &result[abs_pos + old_str.len()..]);
                            break;
                        }
                        search_from = abs_pos + old_str.len();
                    }
                    CellValue::Text(result)
                }
            }
        }
        "REPLACE" => {
            if args.len() < 4 { return CellValue::Error("#VALUE!".to_string()); }
            let text = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let start = (cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize).saturating_sub(1);
            let num_chars = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as usize;
            let new_text = cv_to_string(&evaluate(&args[3], ctx, visited, formula_cache));
            let chars: Vec<char> = text.chars().collect();
            let before: String = chars[..start.min(chars.len())].iter().collect();
            let after: String = chars[(start + num_chars).min(chars.len())..].iter().collect();
            CellValue::Text(format!("{}{}{}", before, new_text, after))
        }
        "TRIM" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            // Trim leading/trailing whitespace and collapse internal spaces
            let trimmed = s.split_whitespace().collect::<Vec<&str>>().join(" ");
            CellValue::Text(trimmed)
        }
        "CLEAN" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            // Remove non-printable characters (ASCII 0-31)
            CellValue::Text(s.chars().filter(|c| *c as u32 >= 32).collect())
        }
        "TEXT" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            let fmt = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache));
            match val {
                CellValue::Number(n) => CellValue::Text(format_number_with_code(n, &fmt)),
                _ => CellValue::Text(cv_to_string(&val)),
            }
        }
        "VALUE" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            match s.parse::<f64>() {
                Ok(n) => CellValue::Number(n),
                Err(_) => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "EXACT" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let a = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let b = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache));
            CellValue::Bool(a == b)
        }
        "REPT" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let n = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as usize;
            CellValue::Text(s.repeat(n))
        }
        "PROPER" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let result: String = s.chars().scan(true, |cap, c| {
                let out = if *cap { c.to_uppercase().next().unwrap_or(c) } else { c.to_lowercase().next().unwrap_or(c) };
                *cap = !c.is_alphanumeric();
                Some(out)
            }).collect();
            CellValue::Text(result)
        }
        "CHAR" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)) as u32;
            match char::from_u32(n) {
                Some(c) => CellValue::Text(c.to_string()),
                None => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "CODE" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            match s.chars().next() {
                Some(c) => CellValue::Number(c as u32 as f64),
                None => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "TEXTJOIN" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let delim = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let skip_empty = match evaluate(&args[1], ctx, visited, formula_cache) {
                CellValue::Bool(b) => b,
                CellValue::Number(n) => n != 0.0,
                _ => true,
            };
            let values = flatten_args(&args[2..], ctx, visited, formula_cache);
            let parts: Vec<String> = values.iter()
                .map(|v| cv_to_string(v))
                .filter(|s| !skip_empty || !s.is_empty())
                .collect();
            CellValue::Text(parts.join(&delim))
        }
        "TEXTBEFORE" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let text = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let delim = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache));
            match text.find(&delim) {
                Some(pos) => CellValue::Text(text[..pos].to_string()),
                None => CellValue::Error("#N/A".to_string()),
            }
        }
        "TEXTAFTER" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let text = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            let delim = cv_to_string(&evaluate(&args[1], ctx, visited, formula_cache));
            match text.find(&delim) {
                Some(pos) => CellValue::Text(text[pos + delim.len()..].to_string()),
                None => CellValue::Error("#N/A".to_string()),
            }
        }

        // ─── Date / Time ──────────────────────────────────────────────────────────
        "TODAY" => {
            let ms = JsDate::now();
            let total_days = (ms / 86_400_000.0).floor();
            // JS epoch is Jan 1, 1970 = Excel serial 25569
            CellValue::Number(total_days + 25569.0)
        }
        "NOW" => {
            let ms = JsDate::now();
            CellValue::Number(ms / 86_400_000.0 + 25569.0)
        }
        "DATE" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let y = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)) as i32;
            let m = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32;
            let d = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as i32;
            CellValue::Number(date_to_serial(y, m, d))
        }
        "YEAR" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let (y, _, _) = serial_to_date(serial);
            CellValue::Number(y as f64)
        }
        "MONTH" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let (_, m, _) = serial_to_date(serial);
            CellValue::Number(m as f64)
        }
        "DAY" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let (_, _, d) = serial_to_date(serial);
            CellValue::Number(d as f64)
        }
        "HOUR" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let (h, _, _) = serial_to_time(serial);
            CellValue::Number(h as f64)
        }
        "MINUTE" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let (_, m, _) = serial_to_time(serial);
            CellValue::Number(m as f64)
        }
        "SECOND" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let (_, _, s) = serial_to_time(serial);
            CellValue::Number(s as f64)
        }
        "TIME" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let h = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)) as u32;
            let m = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as u32;
            let s = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache)) as u32;
            CellValue::Number(time_to_serial(h, m, s))
        }
        "DATEVALUE" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            match parse_date_string(&s) {
                Some(serial) => CellValue::Number(serial),
                None => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "TIMEVALUE" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], ctx, visited, formula_cache));
            // Parse HH:MM:SS or HH:MM
            let parts: Vec<&str> = s.trim().split(':').collect();
            if parts.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let h: u32 = parts[0].trim().parse().unwrap_or(0);
            let m: u32 = parts[1].trim().parse().unwrap_or(0);
            let sec: u32 = if parts.len() > 2 { parts[2].trim().parse().unwrap_or(0) } else { 0 };
            CellValue::Number(time_to_serial(h, m, sec))
        }
        "EDATE" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let base = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let months = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32;
            CellValue::Number(edate_serial(base, months))
        }
        "EOMONTH" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let base = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let months = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32;
            // Go to first day of month after target month
            let target = edate_serial(base, months);
            let (y, m, _) = serial_to_date(target);
            let dim = days_in_month(y, m);
            CellValue::Number(date_to_serial(y, m as i32, dim as i32))
        }
        "NETWORKDAYS" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let start = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)).floor() as i64;
            let end = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)).floor() as i64;
            if start > end { return CellValue::Number(0.0); }
            let mut count = 0i64;
            for s in start..=end {
                let dow = ((s + 1) % 7) as u32; // 0=Sun..6=Sat (Excel serial 1 = Sun)
                if dow != 0 && dow != 6 { count += 1; } // exclude Sun(0) and Sat(6)
            }
            CellValue::Number(count as f64)
        }
        "WORKDAY" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let start = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache)).floor() as i64;
            let days = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i64;
            let mut current = start;
            let mut remaining = days.abs();
            let direction: i64 = if days >= 0 { 1 } else { -1 };
            while remaining > 0 {
                current += direction;
                let dow = ((current + 1) % 7) as u32;
                if dow != 0 && dow != 6 { remaining -= 1; }
            }
            CellValue::Number(current as f64)
        }
        "DATEDIF" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let start = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let end = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let unit = cv_to_string(&evaluate(&args[2], ctx, visited, formula_cache)).to_uppercase();
            let (sy, sm, sd) = serial_to_date(start);
            let (ey, em, ed) = serial_to_date(end);
            let result = match unit.as_str() {
                "Y" => (ey - sy) as f64 - if (em, ed) < (sm, sd) { 1.0 } else { 0.0 },
                "M" => {
                    let mut months = (ey - sy) * 12 + em as i32 - sm as i32;
                    if ed < sd { months -= 1; }
                    months as f64
                }
                "D" => (end - start).floor(),
                "MD" => (ed as i32 - sd as i32).abs() as f64,
                "YM" => {
                    let mut m = em as i32 - sm as i32;
                    if m < 0 { m += 12; }
                    m as f64
                }
                "YD" => (end - date_to_serial(ey, sm as i32, sd as i32)).abs(),
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            CellValue::Number(result)
        }
        "WEEKDAY" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let return_type = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32 } else { 1 };
            CellValue::Number(serial_to_weekday(serial, return_type) as f64)
        }
        "WEEKNUM" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let serial = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let return_type = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) as i32 } else { 1 };
            CellValue::Number(serial_to_weeknum(serial, return_type) as f64)
        }

        // ─── Logical ──────────────────────────────────────────────────────────────
        "IFS" => {
            // IFS(cond1, val1, cond2, val2, ...)
            let mut i = 0;
            while i + 1 < args.len() {
                let cond = evaluate(&args[i], ctx, visited, formula_cache);
                let is_true = match cond {
                    CellValue::Bool(b) => b,
                    CellValue::Number(n) => n != 0.0,
                    _ => false,
                };
                if is_true { return evaluate(&args[i + 1], ctx, visited, formula_cache); }
                i += 2;
            }
            CellValue::Error("#N/A".to_string())
        }
        "SWITCH" => {
            // SWITCH(expression, value1, result1, [value2, result2, ...], [default])
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let expr_val = evaluate(&args[0], ctx, visited, formula_cache);
            let expr_str = cv_to_string(&expr_val).to_uppercase();
            let expr_num = cv_to_number(&expr_val);
            let mut i = 1;
            while i + 1 < args.len() {
                let case_val = evaluate(&args[i], ctx, visited, formula_cache);
                let is_match = if let (Some(en), Some(cn)) = (expr_num, cv_to_number(&case_val)) {
                    (en - cn).abs() < 1e-10
                } else {
                    cv_to_string(&case_val).to_uppercase() == expr_str
                };
                if is_match { return evaluate(&args[i + 1], ctx, visited, formula_cache); }
                i += 2;
            }
            // Default value if count is odd
            if args.len() % 2 == 0 {
                evaluate(&args[args.len() - 1], ctx, visited, formula_cache)
            } else {
                CellValue::Error("#N/A".to_string())
            }
        }
        "IFERROR" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            if matches!(val, CellValue::Error(_)) {
                if args.len() > 1 { evaluate(&args[1], ctx, visited, formula_cache) } else { CellValue::Text(String::new()) }
            } else {
                val
            }
        }
        "IFNA" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            if matches!(&val, CellValue::Error(e) if e == "#N/A") {
                if args.len() > 1 { evaluate(&args[1], ctx, visited, formula_cache) } else { CellValue::Text(String::new()) }
            } else {
                val
            }
        }
        "ISBLANK" => {
            if args.is_empty() { return CellValue::Bool(false); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(matches!(val, CellValue::Empty))
        }
        "ISERROR" => {
            if args.is_empty() { return CellValue::Bool(false); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(matches!(val, CellValue::Error(_)))
        }
        "ISERR" => {
            // Like ISERROR but excludes #N/A
            if args.is_empty() { return CellValue::Bool(false); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(matches!(&val, CellValue::Error(e) if e != "#N/A"))
        }
        "ISNUMBER" => {
            if args.is_empty() { return CellValue::Bool(false); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(matches!(val, CellValue::Number(_)))
        }
        "ISTEXT" => {
            if args.is_empty() { return CellValue::Bool(false); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(matches!(val, CellValue::Text(_)))
        }
        "ISNONTEXT" => {
            if args.is_empty() { return CellValue::Bool(true); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(!matches!(val, CellValue::Text(_)))
        }
        "ISLOGICAL" => {
            if args.is_empty() { return CellValue::Bool(false); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            CellValue::Bool(matches!(val, CellValue::Bool(_)))
        }

        // ─── Financial ────────────────────────────────────────────────────────────
        "PMT" => {
            // PMT(rate, nper, pv, [fv], [type])
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let rate = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let nper = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let pv   = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            let fv   = if args.len() > 3 { cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache)) } else { 0.0 };
            let pmt_type = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) as i32 } else { 0 };
            if nper == 0.0 { return CellValue::Error("#DIV/0!".to_string()); }
            CellValue::Number(annuity_pmt(rate, nper, pv, fv, pmt_type))
        }
        "PV" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let rate = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let nper = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let pmt  = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            let fv   = if args.len() > 3 { cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache)) } else { 0.0 };
            let pmt_type = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) as i32 } else { 0 };
            CellValue::Number(annuity_pv(rate, nper, pmt, fv, pmt_type))
        }
        "FV" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let rate = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let nper = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let pmt  = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            let pv   = if args.len() > 3 { cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache)) } else { 0.0 };
            let pmt_type = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) as i32 } else { 0 };
            CellValue::Number(annuity_fv(rate, nper, pmt, pv, pmt_type))
        }
        "NPER" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let rate = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let pmt  = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let pv   = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            let fv   = if args.len() > 3 { cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache)) } else { 0.0 };
            let pmt_type = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) as i32 } else { 0 };
            CellValue::Number(annuity_nper(rate, pmt, pv, fv, pmt_type))
        }
        "NPV" => {
            if args.len() < 2 { return CellValue::Error("#VALUE!".to_string()); }
            let rate = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let cashflows = flatten_args(&args[1..], ctx, visited, formula_cache);
            let result: f64 = cashflows.iter().enumerate().filter_map(|(i, v)| {
                cv_to_number(v).map(|cf| cf / (1.0 + rate).powi((i + 1) as i32))
            }).sum();
            CellValue::Number(result)
        }
        "IRR" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let cashflows: Vec<f64> = flatten_args(&args[..1], ctx, visited, formula_cache)
                .iter().filter_map(|v| cv_to_number(v)).collect();
            let guess = if args.len() > 1 { cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache)) } else { 0.1 };
            match newton_raphson_irr(&cashflows, guess) {
                Some(rate) => CellValue::Number(rate),
                None => CellValue::Error("#NUM!".to_string()),
            }
        }
        "RATE" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let nper = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let pmt  = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let pv   = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            let fv   = if args.len() > 3 { cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache)) } else { 0.0 };
            let pmt_type = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) as i32 } else { 0 };
            let guess = if args.len() > 5 { cv_to_number_or_zero(&evaluate(&args[5], ctx, visited, formula_cache)) } else { 0.1 };
            // Newton-Raphson on NPER equation rearranged: f(r) = FV_calc(r) - fv
            let mut rate = guess;
            for _ in 0..100 {
                let fv_calc = annuity_fv(rate, nper, pmt, pv, pmt_type);
                let fv_calc2 = annuity_fv(rate + 1e-6, nper, pmt, pv, pmt_type);
                let deriv = (fv_calc2 - fv_calc) / 1e-6;
                if deriv.abs() < 1e-20 { break; }
                let new_rate = rate - (fv_calc - fv) / deriv;
                if (new_rate - rate).abs() < 1e-10 { rate = new_rate; break; }
                rate = new_rate;
            }
            CellValue::Number(rate)
        }
        "SLN" => {
            if args.len() < 3 { return CellValue::Error("#VALUE!".to_string()); }
            let cost    = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let salvage = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let life    = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            if life == 0.0 { return CellValue::Error("#DIV/0!".to_string()); }
            CellValue::Number((cost - salvage) / life)
        }
        "DB" => {
            // DB(cost, salvage, life, period, [month])
            if args.len() < 4 { return CellValue::Error("#VALUE!".to_string()); }
            let cost    = cv_to_number_or_zero(&evaluate(&args[0], ctx, visited, formula_cache));
            let salvage = cv_to_number_or_zero(&evaluate(&args[1], ctx, visited, formula_cache));
            let life    = cv_to_number_or_zero(&evaluate(&args[2], ctx, visited, formula_cache));
            let period  = cv_to_number_or_zero(&evaluate(&args[3], ctx, visited, formula_cache));
            let month   = if args.len() > 4 { cv_to_number_or_zero(&evaluate(&args[4], ctx, visited, formula_cache)) } else { 12.0 };
            if cost == 0.0 || life == 0.0 { return CellValue::Number(0.0); }
            let rate = 1.0 - (salvage / cost).powf(1.0 / life);
            let rate = (rate * 1000.0).round() / 1000.0; // Excel rounds to 3 decimal places
            let mut book = cost;
            let mut dep = 0.0;
            for p in 1..=(period as usize) {
                dep = if p == 1 {
                    cost * rate * month / 12.0
                } else if p == (life as usize + 1) {
                    (book - salvage.max(0.0)) * rate * (12.0 - month) / 12.0
                } else {
                    book * rate
                };
                if p < period as usize { book -= dep; }
            }
            CellValue::Number(dep)
        }

        // ─── Information ─────────────────────────────────────────────────────────
        "TYPE" => {
            if args.is_empty() { return CellValue::Error("#VALUE!".to_string()); }
            let val = evaluate(&args[0], ctx, visited, formula_cache);
            let t: f64 = match val {
                CellValue::Number(_) => 1.0,
                CellValue::Text(_) => 2.0,
                CellValue::Bool(_) => 4.0,
                CellValue::Error(_) => 16.0,
                CellValue::Empty => 1.0,
            };
            CellValue::Number(t)
        }
        "CELL" | "INFO" => {
            // These require deep workbook metadata not available in the engine
            CellValue::Error("#N/A".to_string())
        }
        "NA" => CellValue::Error("#N/A".to_string()),
        "TRUE" => CellValue::Bool(true),
        "FALSE" => CellValue::Bool(false),
        "XOR" => {
            let values = flatten_args(args, ctx, visited, formula_cache);
            let count_true = values.iter().filter(|v| match v {
                CellValue::Bool(b) => *b,
                CellValue::Number(n) => *n != 0.0,
                _ => false,
            }).count();
            CellValue::Bool(count_true % 2 == 1)
        }

        _ => CellValue::Error(format!("#NAME? ({})", name)),
    }
}

/// Flatten arguments, expanding range references (same-sheet and cross-sheet) into individual cell values
fn flatten_args(
    args: &[Expr],
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> Vec<CellValue> {
    let mut result = Vec::new();
    for arg in args {
        match arg {
            Expr::RangeRef { col1, row1, col2, row2 } => {
                for r in *row1..=*row2 {
                    for c in *col1..=*col2 {
                        result.push(get_cell_value(r, c, ctx.active_sheet, ctx, visited, formula_cache));
                    }
                }
            }
            Expr::SheetRangeRef { sheet, col1, row1, col2, row2 } => {
                for r in *row1..=*row2 {
                    for c in *col1..=*col2 {
                        result.push(get_cell_value(r, c, sheet, ctx, visited, formula_cache));
                    }
                }
            }
            _ => {
                result.push(evaluate(arg, ctx, visited, formula_cache));
            }
        }
    }
    result
}

fn get_cell_value(
    row: u32,
    col: u32,
    sheet: &str,
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    let key = format!("{}:{}:{}", sheet, row, col);

    // Check cache first
    if let Some(cached) = formula_cache.get(&key) {
        return cached.clone();
    }

    // Circular reference detection
    if visited.contains(&key) {
        return CellValue::Error("#CIRC!".to_string());
    }

    let cells = match ctx.all_sheets.get(sheet) {
        Some(s) => s,
        None => return CellValue::Empty,
    };

    let row_key = row.to_string();
    let col_key = col.to_string();

    let cell_obj = cells.get(&row_key).and_then(|r| r.get(&col_key));
    match cell_obj {
        None => CellValue::Empty,
        Some(cell) => {
            let value = cell.get("value").and_then(|v| v.as_str()).unwrap_or("");
            let data_type = cell.get("data_type").and_then(|v| v.as_str()).unwrap_or("s");

            if value.is_empty() || data_type == "null" {
                return CellValue::Empty;
            }

            // If it's a formula, evaluate recursively in the context of the cell's sheet
            if value.starts_with('=') {
                visited.insert(key.clone());
                let cell_ctx = EvalCtx {
                    all_sheets: ctx.all_sheets,
                    active_sheet: sheet,
                    named_ranges: ctx.named_ranges,
                };
                let result = match tokenize(value).and_then(|tokens| {
                    let mut parser = Parser::new(tokens);
                    parser.parse()
                }) {
                    Ok(expr) => evaluate(&expr, &cell_ctx, visited, formula_cache),
                    Err(e) => CellValue::Error(format!("#ERROR! {}", e)),
                };
                visited.remove(&key);
                formula_cache.insert(key, result.clone());
                return result;
            }

            match data_type {
                "n" => {
                    if let Ok(n) = value.parse::<f64>() {
                        CellValue::Number(n)
                    } else {
                        CellValue::Text(value.to_string())
                    }
                }
                "b" => CellValue::Bool(value == "true" || value == "TRUE"),
                "e" => CellValue::Error(value.to_string()),
                _ => {
                    if let Ok(n) = value.parse::<f64>() {
                        CellValue::Number(n)
                    } else {
                        CellValue::Text(value.to_string())
                    }
                }
            }
        }
    }
}

fn cv_to_number(v: &CellValue) -> Option<f64> {
    match v {
        CellValue::Number(n) => Some(*n),
        CellValue::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        CellValue::Text(s) => s.parse::<f64>().ok(),
        CellValue::Empty => None,
        CellValue::Error(_) => None,
    }
}

fn cv_to_number_or_zero(v: &CellValue) -> f64 {
    cv_to_number(v).unwrap_or(0.0)
}

fn cv_to_string(v: &CellValue) -> String {
    match v {
        CellValue::Number(n) => {
            if *n == (*n as i64) as f64 && n.abs() < 1e15 {
                format!("{}", *n as i64)
            } else {
                format!("{}", n)
            }
        }
        CellValue::Text(s) => s.clone(),
        CellValue::Bool(b) => if *b { "TRUE".to_string() } else { "FALSE".to_string() },
        CellValue::Error(e) => e.clone(),
        CellValue::Empty => String::new(),
    }
}

// ─── Helper: wildcard matching (for SUMIF/COUNTIF/etc.) ──────────────────────

fn wildcard_match(text: &str, pattern: &str) -> bool {
    let t: Vec<char> = text.chars().collect();
    let p: Vec<char> = pattern.chars().collect();
    wildcard_match_inner(&t, &p, 0, 0)
}

fn wildcard_match_inner(text: &[char], pattern: &[char], ti: usize, pi: usize) -> bool {
    if pi == pattern.len() {
        return ti == text.len();
    }
    if pattern[pi] == '*' {
        let next_pi = pi + 1;
        if next_pi == pattern.len() { return true; }
        for ti2 in ti..=text.len() {
            if wildcard_match_inner(text, pattern, ti2, next_pi) { return true; }
        }
        false
    } else if pattern[pi] == '?' {
        ti < text.len() && wildcard_match_inner(text, pattern, ti + 1, pi + 1)
    } else {
        ti < text.len() && text[ti] == pattern[pi] && wildcard_match_inner(text, pattern, ti + 1, pi + 1)
    }
}

fn matches_criteria(value: &CellValue, criteria: &CellValue) -> bool {
    match criteria {
        CellValue::Number(n) => {
            return cv_to_number(value).map(|v| (v - n).abs() < 1e-10).unwrap_or(false);
        }
        CellValue::Bool(b) => {
            return matches!(value, CellValue::Bool(vb) if vb == b);
        }
        CellValue::Empty => return matches!(value, CellValue::Empty),
        CellValue::Error(_) => return false,
        CellValue::Text(crit_str) => {
            let crit_str = crit_str.clone();
            let (op, rest): (&str, &str) = if let Some(r) = crit_str.strip_prefix(">=") {
                (">=", r)
            } else if let Some(r) = crit_str.strip_prefix("<=") {
                ("<=", r)
            } else if let Some(r) = crit_str.strip_prefix("<>") {
                ("<>", r)
            } else if let Some(r) = crit_str.strip_prefix('>') {
                (">", r)
            } else if let Some(r) = crit_str.strip_prefix('<') {
                ("<", r)
            } else if let Some(r) = crit_str.strip_prefix('=') {
                ("=", r)
            } else {
                ("=", crit_str.as_str())
            };
            if let Ok(crit_num) = rest.parse::<f64>() {
                let val_num = cv_to_number(value);
                return match op {
                    ">" => val_num.map(|v| v > crit_num).unwrap_or(false),
                    ">=" => val_num.map(|v| v >= crit_num).unwrap_or(false),
                    "<" => val_num.map(|v| v < crit_num).unwrap_or(false),
                    "<=" => val_num.map(|v| v <= crit_num).unwrap_or(false),
                    "<>" => val_num.map(|v| (v - crit_num).abs() >= 1e-10).unwrap_or(true),
                    _ => val_num.map(|v| (v - crit_num).abs() < 1e-10).unwrap_or(false),
                };
            }
            let val_str = cv_to_string(value).to_uppercase();
            let rest_upper = rest.to_uppercase();
            match op {
                "<>" => !wildcard_match(&val_str, &rest_upper),
                _ => wildcard_match(&val_str, &rest_upper),
            }
        }
    }
}

fn eval_range_to_vec(
    arg: &Expr,
    ctx: &EvalCtx,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> Vec<(u32, u32, CellValue)> {
    match arg {
        Expr::RangeRef { col1, row1, col2, row2 } => {
            let mut result = Vec::new();
            for r in *row1..=*row2 {
                for c in *col1..=*col2 {
                    let v = get_cell_value(r, c, ctx.active_sheet, ctx, visited, formula_cache);
                    result.push((r, c, v));
                }
            }
            result
        }
        Expr::SheetRangeRef { sheet, col1, row1, col2, row2 } => {
            let mut result = Vec::new();
            for r in *row1..=*row2 {
                for c in *col1..=*col2 {
                    let v = get_cell_value(r, c, sheet, ctx, visited, formula_cache);
                    result.push((r, c, v));
                }
            }
            result
        }
        _ => {
            let v = evaluate(arg, ctx, visited, formula_cache);
            vec![(0, 0, v)]
        }
    }
}

// ─── Helper: Date serial number conversion (Excel 1900 epoch) ─────────────────

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if is_leap_year(year) { 29 } else { 28 },
        _ => 30,
    }
}

fn date_to_serial(year: i32, month: i32, day: i32) -> f64 {
    let mut y = year;
    let mut m = month;
    let d = day;
    while m > 12 { m -= 12; y += 1; }
    while m < 1 { m += 12; y -= 1; }
    let mut serial: i64 = 0;
    for yr in 1900..y {
        serial += if is_leap_year(yr) { 366 } else { 365 };
    }
    for mo in 1..m {
        serial += days_in_month(y, mo as u32) as i64;
    }
    serial += d as i64;
    // Lotus 1-2-3 bug: Excel treats 1900 as a leap year
    if serial >= 60 { serial += 1; }
    serial as f64
}

fn serial_to_date(serial: f64) -> (i32, u32, u32) {
    let mut s = serial as i64;
    if s >= 61 { s -= 1; } // adjust for Lotus bug
    let mut year = 1900i32;
    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if s <= days_in_year as i64 { break; }
        s -= days_in_year as i64;
        year += 1;
    }
    let mut month = 1u32;
    loop {
        let dim = days_in_month(year, month);
        if s <= dim as i64 { break; }
        s -= dim as i64;
        month += 1;
        if month > 12 { break; }
    }
    (year, month, s as u32)
}

fn time_to_serial(hour: u32, min: u32, sec: u32) -> f64 {
    (hour as f64 * 3600.0 + min as f64 * 60.0 + sec as f64) / 86400.0
}

fn serial_to_time(serial: f64) -> (u32, u32, u32) {
    let frac = serial.fract().abs();
    let total_secs = (frac * 86400.0).round() as u32;
    let h = total_secs / 3600;
    let m = (total_secs % 3600) / 60;
    let s = total_secs % 60;
    (h, m, s)
}

fn parse_date_string(s: &str) -> Option<f64> {
    let s = s.trim();
    // YYYY-MM-DD
    if let Some(serial) = (|| -> Option<f64> {
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() != 3 { return None; }
        let y: i32 = parts[0].parse().ok()?;
        let m: i32 = parts[1].parse().ok()?;
        let d: i32 = parts[2].parse().ok()?;
        Some(date_to_serial(y, m, d))
    })() { return Some(serial); }
    // MM/DD/YYYY
    if let Some(serial) = (|| -> Option<f64> {
        let parts: Vec<&str> = s.split('/').collect();
        if parts.len() != 3 { return None; }
        let m: i32 = parts[0].parse().ok()?;
        let d: i32 = parts[1].parse().ok()?;
        let y: i32 = parts[2].parse().ok()?;
        Some(date_to_serial(y, m, d))
    })() { return Some(serial); }
    None
}

fn edate_serial(base: f64, months: i32) -> f64 {
    let (y, m, d) = serial_to_date(base);
    let mut new_month = m as i32 + months;
    let mut new_year = y;
    while new_month > 12 { new_month -= 12; new_year += 1; }
    while new_month < 1 { new_month += 12; new_year -= 1; }
    let max_day = days_in_month(new_year, new_month as u32);
    date_to_serial(new_year, new_month, d.min(max_day) as i32)
}

// ─── Helper: Number formatting for TEXT() ─────────────────────────────────────

fn format_number_with_code(n: f64, fmt: &str) -> String {
    let fmt = fmt.trim();
    // Percentage
    if fmt.contains('%') {
        let pct = n * 100.0;
        let dec = fmt.split('.').nth(1).map(|s| s.chars().filter(|c| *c == '0').count()).unwrap_or(0);
        return format!("{:.prec$}%", pct, prec = dec);
    }
    // Date formats
    let fmt_lower = fmt.to_lowercase();
    if fmt_lower.contains("yyyy") || fmt_lower.contains("mm") || fmt_lower.contains("dd") {
        let (y, mo, d) = serial_to_date(n);
        return fmt_lower
            .replace("yyyy", &format!("{:04}", y))
            .replace("mm", &format!("{:02}", mo))
            .replace("dd", &format!("{:02}", d));
    }
    let has_comma = fmt.contains(',');
    let parts: Vec<&str> = fmt.split('.').collect();
    let decimal_places = if parts.len() > 1 {
        parts[1].chars().filter(|c| *c == '0' || *c == '#').count()
    } else {
        0
    };
    let formatted = format!("{:.prec$}", n, prec = decimal_places);
    if has_comma {
        let negative = n < 0.0;
        let abs_val = n.abs();
        let abs_fmt = format!("{:.prec$}", abs_val, prec = decimal_places);
        let (int_str, dec_str) = if let Some(dot) = abs_fmt.find('.') {
            (&abs_fmt[..dot], Some(&abs_fmt[dot..]))
        } else {
            (abs_fmt.as_str(), None)
        };
        let mut with_commas = String::new();
        for (i, ch) in int_str.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 { with_commas.push(','); }
            with_commas.push(ch);
        }
        let int_result: String = with_commas.chars().rev().collect();
        let sign = if negative { "-" } else { "" };
        match dec_str {
            Some(dec) => format!("{}{}{}", sign, int_result, dec),
            None => format!("{}{}", sign, int_result),
        }
    } else {
        formatted
    }
}

// ─── Helper: INDIRECT cell ref parsing ────────────────────────────────────────

fn parse_indirect_ref(s: &str) -> Option<(u32, u32)> {
    let clean: String = s.chars().filter(|c| *c != '$').collect();
    let cell_part = if let Some(pos) = clean.rfind('!') { &clean[pos+1..] } else { clean.as_str() };
    let cell_upper = cell_part.trim().to_uppercase();
    let col_end = cell_upper.chars().take_while(|c| c.is_alphabetic()).count();
    if col_end == 0 { return None; }
    let col_str = &cell_upper[..col_end];
    let row_str = &cell_upper[col_end..];
    let row: u32 = row_str.parse::<u32>().ok()?.checked_sub(1)?;
    let mut col: u32 = 0;
    for ch in col_str.chars() {
        col = col * 26 + (ch as u32 - 'A' as u32 + 1);
    }
    Some((row, col - 1))
}

// ─── Helper: Financial functions ──────────────────────────────────────────────

fn annuity_pmt(rate: f64, nper: f64, pv: f64, fv: f64, pmt_type: i32) -> f64 {
    if rate == 0.0 { return -(pv + fv) / nper; }
    let factor = (1.0 + rate).powf(nper);
    -((pv * factor + fv) * rate) / ((factor - 1.0) * (1.0 + rate * pmt_type as f64))
}

fn annuity_fv(rate: f64, nper: f64, pmt: f64, pv: f64, pmt_type: i32) -> f64 {
    if rate == 0.0 { return -(pv + pmt * nper); }
    let factor = (1.0 + rate).powf(nper);
    -(pv * factor + pmt * (1.0 + rate * pmt_type as f64) * (factor - 1.0) / rate)
}

fn annuity_pv(rate: f64, nper: f64, pmt: f64, fv: f64, pmt_type: i32) -> f64 {
    if rate == 0.0 { return -(fv + pmt * nper); }
    let factor = (1.0 + rate).powf(nper);
    -(fv + pmt * (1.0 + rate * pmt_type as f64) * (factor - 1.0) / rate) / factor
}

fn annuity_nper(rate: f64, pmt: f64, pv: f64, fv: f64, pmt_type: i32) -> f64 {
    if rate == 0.0 {
        if pmt == 0.0 { return f64::INFINITY; }
        return -(pv + fv) / pmt;
    }
    let adj_pmt = pmt * (1.0 + rate * pmt_type as f64);
    ((-fv * rate + adj_pmt).ln() - (pv * rate + adj_pmt).ln()) / (1.0 + rate).ln()
}

fn newton_raphson_irr(cashflows: &[f64], guess: f64) -> Option<f64> {
    let mut rate = guess;
    for _ in 0..100 {
        let mut npv = 0.0;
        let mut dnpv = 0.0;
        for (i, &cf) in cashflows.iter().enumerate() {
            let factor = (1.0 + rate).powi(i as i32);
            npv += cf / factor;
            if factor.abs() > 1e-20 {
                dnpv -= (i as f64) * cf / ((1.0 + rate) * factor);
            }
        }
        if dnpv.abs() < 1e-20 { break; }
        let new_rate = rate - npv / dnpv;
        if (new_rate - rate).abs() < 1e-10 { return Some(new_rate); }
        rate = new_rate;
    }
    Some(rate)
}

// ─── Helper: weekday from serial ──────────────────────────────────────────────

fn serial_to_weekday(serial: f64, return_type: i32) -> u32 {
    // Excel serial 1 = Jan 1 1900 = Sunday (day index 0 in a Sun-based week)
    // serial 1 was actually a Sunday
    let s = serial as i64;
    let dow = ((s + 1) % 7) as u32; // 0=Sun,1=Mon,...,6=Sat
    match return_type {
        2 => if dow == 0 { 7 } else { dow },           // 1=Mon..7=Sun
        3 => if dow == 0 { 6 } else { dow - 1 },       // 0=Mon..6=Sun
        _ => dow + 1,                                   // 1=Sun..7=Sat (default)
    }
}

fn serial_to_weeknum(serial: f64, return_type: i32) -> u32 {
    let (y, _, _) = serial_to_date(serial);
    let jan1 = date_to_serial(y, 1, 1);
    let jan1_dow = serial_to_weekday(jan1, return_type);
    // Days into the year
    let day_of_year = (serial - jan1) as u32 + 1;
    // Adjust for first partial week
    let adjusted = day_of_year + jan1_dow - 2;
    adjusted / 7 + 1
}

/// Extract dependencies from an expression (cell refs and range refs).
/// For cross-sheet refs, uses "SheetName:row:col" format.
fn extract_deps(expr: &Expr) -> Vec<String> {
    let mut deps = Vec::new();
    match expr {
        Expr::CellRef { col, row } => {
            // Use a special prefix so active-sheet deps can be keyed generically
            deps.push(format!("{}:{}", row, col));
        }
        Expr::RangeRef { col1, row1, col2, row2 } => {
            for r in *row1..=*row2 {
                for c in *col1..=*col2 {
                    deps.push(format!("{}:{}", r, c));
                }
            }
        }
        Expr::SheetCellRef { sheet, col, row } => {
            deps.push(format!("{}:{}:{}", sheet, row, col));
        }
        Expr::SheetRangeRef { sheet, col1, row1, col2, row2 } => {
            for r in *row1..=*row2 {
                for c in *col1..=*col2 {
                    deps.push(format!("{}:{}:{}", sheet, r, c));
                }
            }
        }
        Expr::BinOp { left, right, .. } => {
            deps.extend(extract_deps(left));
            deps.extend(extract_deps(right));
        }
        Expr::UnaryMinus(inner) => {
            deps.extend(extract_deps(inner));
        }
        Expr::FuncCall { args, .. } => {
            for arg in args {
                deps.extend(extract_deps(arg));
            }
        }
        _ => {}
    }
    deps
}

// --- WASM API ---

#[wasm_bindgen]
pub struct FormulaEngine {
    /// Dependency graph: cell_key -> list of cells that depend on it
    dependents: HashMap<String, Vec<String>>,
    /// Cache of evaluated formula results
    cache: HashMap<String, CellValue>,
    /// Named ranges: UPPERCASE name -> formula (without leading '=')
    named_ranges: HashMap<String, String>,
}

#[wasm_bindgen]
impl FormulaEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FormulaEngine {
        FormulaEngine {
            dependents: HashMap::new(),
            cache: HashMap::new(),
            named_ranges: HashMap::new(),
        }
    }

    /// Register named ranges from the workbook model.
    /// `json` is an array of { name, formula, local_sheet_id?, hidden? } objects.
    pub fn set_named_ranges(&mut self, json: &str) -> Result<(), JsError> {
        self.named_ranges.clear();
        let items: Vec<serde_json::Value> = serde_json::from_str(json)
            .map_err(|e| JsError::new(&e.to_string()))?;
        for item in items {
            if let (Some(name), Some(formula)) = (
                item.get("name").and_then(|v| v.as_str()),
                item.get("formula").and_then(|v| v.as_str()),
            ) {
                // Skip hidden/built-in names
                let hidden = item.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false);
                if hidden || name.starts_with("_xlnm.") { continue; }
                // Strip leading '=' if present
                let formula_clean = formula.trim_start_matches('=').to_string();
                self.named_ranges.insert(name.to_uppercase(), formula_clean);
            }
        }
        self.cache.clear();
        Ok(())
    }

    /// Evaluate a single cell's formula.
    /// `all_sheets_json` is: { "SheetName": { "row": { "col": { "value": "...", "data_type": "..." } } } }
    /// `active_sheet` is the name of the sheet containing the cell.
    pub fn evaluate_cell(&mut self, row: u32, col: u32, all_sheets_json: &str, active_sheet: &str) -> Result<String, JsError> {
        let all_sheets: HashMap<String, HashMap<String, HashMap<String, serde_json::Value>>> =
            serde_json::from_str(all_sheets_json).map_err(|e| JsError::new(&e.to_string()))?;

        let ctx = EvalCtx {
            all_sheets: &all_sheets,
            active_sheet,
            named_ranges: &self.named_ranges,
        };

        let mut visited = HashSet::new();
        let cv = get_cell_value(row, col, active_sheet, &ctx, &mut visited, &mut self.cache);

        let display = cv_to_string(&cv);
        let is_error = matches!(cv, CellValue::Error(_));

        Ok(serde_json::json!({
            "display": display,
            "is_error": is_error,
            "numeric": cv_to_number(&cv),
        }).to_string())
    }

    /// Evaluate all formula cells across all sheets.
    /// `all_sheets_json` is: { "SheetName": { "row": { "col": { "value": "...", "data_type": "..." } } } }
    /// `active_sheet` is the sheet to return results for.
    /// Returns JSON: { "row:col": { "display": "...", "is_error": bool, "numeric": number|null } }
    pub fn evaluate_all(&mut self, all_sheets_json: &str, active_sheet: &str) -> Result<String, JsError> {
        let all_sheets: HashMap<String, HashMap<String, HashMap<String, serde_json::Value>>> =
            serde_json::from_str(all_sheets_json).map_err(|e| JsError::new(&e.to_string()))?;

        self.cache.clear();
        self.dependents.clear();

        let ctx = EvalCtx {
            all_sheets: &all_sheets,
            active_sheet,
            named_ranges: &self.named_ranges,
        };

        let mut results: HashMap<String, serde_json::Value> = HashMap::new();
        let mut visited = HashSet::new();

        // Evaluate formula cells in all sheets, collect results for active_sheet
        for (sheet_name, sheet_cells) in &all_sheets {
            for (row_key, row_map) in sheet_cells {
                for (col_key, cell) in row_map {
                    let value = cell.get("value").and_then(|v| v.as_str()).unwrap_or("");
                    if value.starts_with('=') {
                        let row: u32 = row_key.parse().unwrap_or(0);
                        let col: u32 = col_key.parse().unwrap_or(0);
                        let cache_key = format!("{}:{}:{}", sheet_name, row, col);

                        // Build dependency graph
                        if let Ok(tokens) = tokenize(value) {
                            let mut parser = Parser::new(tokens);
                            if let Ok(expr) = parser.parse() {
                                let deps = extract_deps(&expr);
                                for dep in deps {
                                    self.dependents.entry(dep).or_default().push(cache_key.clone());
                                }
                            }
                        }

                        // Only fully evaluate (and return in results) the active sheet
                        if sheet_name == active_sheet {
                            visited.clear();
                            let cv = get_cell_value(row, col, sheet_name, &ctx, &mut visited, &mut self.cache);
                            let display = cv_to_string(&cv);
                            let is_error = matches!(cv, CellValue::Error(_));

                            results.insert(format!("{}:{}", row, col), serde_json::json!({
                                "display": display,
                                "is_error": is_error,
                                "numeric": cv_to_number(&cv),
                            }));
                        }
                    }
                }
            }
        }

        Ok(serde_json::to_string(&results).map_err(|e| JsError::new(&e.to_string()))?)
    }

    /// When a cell is edited, return the list of cells (as "row:col") that need re-evaluation.
    pub fn get_dependents(&self, row: u32, col: u32) -> String {
        let key = format!("{}:{}", row, col);
        let mut all_deps = HashSet::new();
        let mut queue = vec![key];

        while let Some(k) = queue.pop() {
            if let Some(deps) = self.dependents.get(&k) {
                for dep in deps {
                    if all_deps.insert(dep.clone()) {
                        queue.push(dep.clone());
                    }
                }
            }
        }

        serde_json::to_string(&all_deps.into_iter().collect::<Vec<_>>()).unwrap_or_else(|_| "[]".to_string())
    }

    /// Invalidate the cache for a cell and its dependents
    pub fn invalidate(&mut self, row: u32, col: u32) {
        let key = format!("{}:{}", row, col);
        self.cache.remove(&key);

        let mut queue = vec![key];
        let mut seen = HashSet::new();
        while let Some(k) = queue.pop() {
            if let Some(deps) = self.dependents.get(&k) {
                for dep in deps {
                    if seen.insert(dep.clone()) {
                        self.cache.remove(dep);
                        queue.push(dep.clone());
                    }
                }
            }
        }
    }
}
