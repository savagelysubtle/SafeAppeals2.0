use wasm_bindgen::prelude::*;
use std::collections::{HashMap, HashSet};
use serde_json;

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

        // String literal
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

        // Identifiers: cell refs, range refs, function names, TRUE/FALSE
        if ch.is_ascii_alphabetic() || ch == '$' || ch == '_' {
            let start = i;
            // Absorb $, letters, digits
            while i < len && (chars[i].is_ascii_alphanumeric() || chars[i] == '$' || chars[i] == '_') {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();

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
                tokens.push(Token::CellRef(word.to_uppercase()));
            } else {
                // Assume it's a function name
                tokens.push(Token::Function(upper));
            }
        }
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
                // Expect '('
                if !matches!(self.peek(), Some(Token::LParen)) {
                    return Err(format!("Expected '(' after function {}", name));
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
    cells: &HashMap<String, HashMap<String, serde_json::Value>>,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    match expr {
        Expr::Num(n) => CellValue::Number(*n),
        Expr::Str(s) => CellValue::Text(s.clone()),
        Expr::Bool(b) => CellValue::Bool(*b),
        Expr::CellRef { col, row } => {
            get_cell_value(*row, *col, cells, visited, formula_cache)
        }
        Expr::RangeRef { .. } => {
            // Range refs should only appear as function arguments; evaluated inline by functions
            CellValue::Error("#VALUE!".to_string())
        }
        Expr::UnaryMinus(inner) => {
            match evaluate(inner, cells, visited, formula_cache) {
                CellValue::Number(n) => CellValue::Number(-n),
                CellValue::Empty => CellValue::Number(0.0),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        Expr::BinOp { op, left, right } => {
            eval_binop(op, left, right, cells, visited, formula_cache)
        }
        Expr::FuncCall { name, args } => {
            eval_function(name, args, cells, visited, formula_cache)
        }
    }
}

fn eval_binop(
    op: &str,
    left: &Expr,
    right: &Expr,
    cells: &HashMap<String, HashMap<String, serde_json::Value>>,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    let lv = evaluate(left, cells, visited, formula_cache);
    let rv = evaluate(right, cells, visited, formula_cache);

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
    cells: &HashMap<String, HashMap<String, serde_json::Value>>,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    match name {
        "SUM" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let sum: f64 = values.iter().filter_map(|v| cv_to_number(v)).sum();
            CellValue::Number(sum)
        }
        "AVERAGE" | "AVG" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() {
                CellValue::Error("#DIV/0!".to_string())
            } else {
                CellValue::Number(nums.iter().sum::<f64>() / nums.len() as f64)
            }
        }
        "COUNT" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let count = values.iter().filter(|v| cv_to_number(v).is_some()).count();
            CellValue::Number(count as f64)
        }
        "COUNTA" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let count = values.iter().filter(|v| !matches!(v, CellValue::Empty)).count();
            CellValue::Number(count as f64)
        }
        "MIN" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let nums: Vec<f64> = values.iter().filter_map(|v| cv_to_number(v)).collect();
            if nums.is_empty() {
                CellValue::Number(0.0)
            } else {
                CellValue::Number(nums.iter().cloned().fold(f64::INFINITY, f64::min))
            }
        }
        "MAX" => {
            let values = flatten_args(args, cells, visited, formula_cache);
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
            let cond = evaluate(&args[0], cells, visited, formula_cache);
            let is_true = match cond {
                CellValue::Bool(b) => b,
                CellValue::Number(n) => n != 0.0,
                _ => false,
            };
            if is_true {
                if args.len() > 1 {
                    evaluate(&args[1], cells, visited, formula_cache)
                } else {
                    CellValue::Bool(true)
                }
            } else if args.len() > 2 {
                evaluate(&args[2], cells, visited, formula_cache)
            } else {
                CellValue::Bool(false)
            }
        }
        "VLOOKUP" => {
            // VLOOKUP(lookup_value, table_range, col_index_num, [range_lookup])
            if args.len() < 3 {
                return CellValue::Error("#VALUE!".to_string());
            }
            let lookup_val = evaluate(&args[0], cells, visited, formula_cache);
            let col_index = match evaluate(&args[2], cells, visited, formula_cache) {
                CellValue::Number(n) => n as u32,
                _ => return CellValue::Error("#VALUE!".to_string()),
            };
            if col_index == 0 {
                return CellValue::Error("#VALUE!".to_string());
            }

            // Get the range
            if let Expr::RangeRef { col1, row1, col2, row2 } = &args[1] {
                if col_index > (col2 - col1 + 1) {
                    return CellValue::Error("#REF!".to_string());
                }
                let target_col = col1 + col_index - 1;
                let lookup_str = cv_to_string(&lookup_val);
                let lookup_num = cv_to_number(&lookup_val);

                for r in *row1..=*row2 {
                    let cell_val = get_cell_value(r, *col1, cells, visited, formula_cache);
                    let matches = if let Some(ln) = lookup_num {
                        if let Some(cn) = cv_to_number(&cell_val) {
                            (ln - cn).abs() < 1e-10
                        } else {
                            false
                        }
                    } else {
                        cv_to_string(&cell_val).to_uppercase() == lookup_str.to_uppercase()
                    };
                    if matches {
                        return get_cell_value(r, target_col, cells, visited, formula_cache);
                    }
                }
                CellValue::Error("#N/A".to_string())
            } else {
                CellValue::Error("#VALUE!".to_string())
            }
        }
        "ABS" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            match evaluate(&args[0], cells, visited, formula_cache) {
                CellValue::Number(n) => CellValue::Number(n.abs()),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "ROUND" => {
            if args.len() < 1 { return CellValue::Error("#VALUE!".to_string()); }
            let n = cv_to_number_or_zero(&evaluate(&args[0], cells, visited, formula_cache));
            let digits = if args.len() > 1 {
                cv_to_number_or_zero(&evaluate(&args[1], cells, visited, formula_cache)) as i32
            } else { 0 };
            let factor = 10f64.powi(digits);
            CellValue::Number((n * factor).round() / factor)
        }
        "LEN" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], cells, visited, formula_cache));
            CellValue::Number(s.len() as f64)
        }
        "UPPER" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], cells, visited, formula_cache));
            CellValue::Text(s.to_uppercase())
        }
        "LOWER" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            let s = cv_to_string(&evaluate(&args[0], cells, visited, formula_cache));
            CellValue::Text(s.to_lowercase())
        }
        "CONCATENATE" | "CONCAT" => {
            let mut result = String::new();
            for arg in args {
                let v = evaluate(arg, cells, visited, formula_cache);
                result.push_str(&cv_to_string(&v));
            }
            CellValue::Text(result)
        }
        "NOT" => {
            if args.len() != 1 { return CellValue::Error("#VALUE!".to_string()); }
            match evaluate(&args[0], cells, visited, formula_cache) {
                CellValue::Bool(b) => CellValue::Bool(!b),
                CellValue::Number(n) => CellValue::Bool(n == 0.0),
                _ => CellValue::Error("#VALUE!".to_string()),
            }
        }
        "AND" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let result = values.iter().all(|v| match v {
                CellValue::Bool(b) => *b,
                CellValue::Number(n) => *n != 0.0,
                _ => false,
            });
            CellValue::Bool(result)
        }
        "OR" => {
            let values = flatten_args(args, cells, visited, formula_cache);
            let result = values.iter().any(|v| match v {
                CellValue::Bool(b) => *b,
                CellValue::Number(n) => *n != 0.0,
                _ => false,
            });
            CellValue::Bool(result)
        }
        _ => CellValue::Error(format!("#NAME? ({})", name)),
    }
}

/// Flatten arguments, expanding range references into individual cell values
fn flatten_args(
    args: &[Expr],
    cells: &HashMap<String, HashMap<String, serde_json::Value>>,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> Vec<CellValue> {
    let mut result = Vec::new();
    for arg in args {
        match arg {
            Expr::RangeRef { col1, row1, col2, row2 } => {
                for r in *row1..=*row2 {
                    for c in *col1..=*col2 {
                        result.push(get_cell_value(r, c, cells, visited, formula_cache));
                    }
                }
            }
            _ => {
                result.push(evaluate(arg, cells, visited, formula_cache));
            }
        }
    }
    result
}

fn get_cell_value(
    row: u32,
    col: u32,
    cells: &HashMap<String, HashMap<String, serde_json::Value>>,
    visited: &mut HashSet<String>,
    formula_cache: &mut HashMap<String, CellValue>,
) -> CellValue {
    let key = format!("{}:{}", row, col);

    // Check cache first
    if let Some(cached) = formula_cache.get(&key) {
        return cached.clone();
    }

    // Circular reference detection
    if visited.contains(&key) {
        return CellValue::Error("#CIRC!".to_string());
    }

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

            // If it's a formula, evaluate recursively
            if value.starts_with('=') {
                visited.insert(key.clone());
                let result = match tokenize(value).and_then(|tokens| {
                    let mut parser = Parser::new(tokens);
                    parser.parse()
                }) {
                    Ok(expr) => evaluate(&expr, cells, visited, formula_cache),
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
                    // Try to parse as number
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

/// Extract dependencies from an expression (cell refs and range refs)
fn extract_deps(expr: &Expr) -> Vec<String> {
    let mut deps = Vec::new();
    match expr {
        Expr::CellRef { col, row } => {
            deps.push(format!("{}:{}", row, col));
        }
        Expr::RangeRef { col1, row1, col2, row2 } => {
            for r in *row1..=*row2 {
                for c in *col1..=*col2 {
                    deps.push(format!("{}:{}", r, c));
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
    // Dependency graph: cell_key -> list of cells that depend on it
    dependents: HashMap<String, Vec<String>>,
    // Cache of evaluated formula results
    cache: HashMap<String, CellValue>,
}

#[wasm_bindgen]
impl FormulaEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FormulaEngine {
        FormulaEngine {
            dependents: HashMap::new(),
            cache: HashMap::new(),
        }
    }

    /// Evaluate a single cell's formula.
    /// `cells_json` is the cells object: { "0": { "0": { "value": "...", "data_type": "..." }, ... }, ... }
    /// Returns JSON: { "value": "...", "display": "..." }
    pub fn evaluate_cell(&mut self, row: u32, col: u32, cells_json: &str) -> Result<String, JsError> {
        let cells: HashMap<String, HashMap<String, serde_json::Value>> =
            serde_json::from_str(cells_json).map_err(|e| JsError::new(&e.to_string()))?;

        let mut visited = HashSet::new();
        let cv = get_cell_value(row, col, &cells, &mut visited, &mut self.cache);

        let display = cv_to_string(&cv);
        let is_error = matches!(cv, CellValue::Error(_));

        Ok(serde_json::json!({
            "display": display,
            "is_error": is_error,
            "numeric": cv_to_number(&cv),
        }).to_string())
    }

    /// Evaluate all formula cells in the sheet.
    /// Returns JSON: { "row:col": { "display": "...", "is_error": bool, "numeric": number|null } }
    pub fn evaluate_all(&mut self, cells_json: &str) -> Result<String, JsError> {
        let cells: HashMap<String, HashMap<String, serde_json::Value>> =
            serde_json::from_str(cells_json).map_err(|e| JsError::new(&e.to_string()))?;

        self.cache.clear();
        self.dependents.clear();

        let mut results: HashMap<String, serde_json::Value> = HashMap::new();
        let mut visited = HashSet::new();

        // Find all formula cells
        for (row_key, row_map) in &cells {
            for (col_key, cell) in row_map {
                let value = cell.get("value").and_then(|v| v.as_str()).unwrap_or("");
                if value.starts_with('=') {
                    let row: u32 = row_key.parse().unwrap_or(0);
                    let col: u32 = col_key.parse().unwrap_or(0);
                    let key = format!("{}:{}", row, col);

                    // Build dependency graph
                    if let Ok(tokens) = tokenize(value) {
                        let mut parser = Parser::new(tokens);
                        if let Ok(expr) = parser.parse() {
                            let deps = extract_deps(&expr);
                            for dep in deps {
                                self.dependents.entry(dep).or_default().push(key.clone());
                            }
                        }
                    }

                    visited.clear();
                    let cv = get_cell_value(row, col, &cells, &mut visited, &mut self.cache);
                    let display = cv_to_string(&cv);
                    let is_error = matches!(cv, CellValue::Error(_));

                    results.insert(key, serde_json::json!({
                        "display": display,
                        "is_error": is_error,
                        "numeric": cv_to_number(&cv),
                    }));
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
