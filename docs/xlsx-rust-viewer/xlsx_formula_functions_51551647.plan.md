---
name: XLSX Formula Functions
overview: "Add ~100 Excel formula functions to the existing Rust WASM formula engine in `formulas.rs`, organized into 8 categories: Math/Trig, Statistical, Lookup, Text, Date/Time, Logical, Financial, and Information. All work is in one file plus a small helper module extraction."
todos:
  - id: helper-infra
    content: "Add helper infrastructure: criteria matching engine, date serial number conversion, financial math helpers, range-to-vec evaluator"
    status: completed
  - id: math-trig
    content: "Implement Math/Trig functions: PRODUCT, MOD, INT, CEILING, FLOOR, POWER, SQRT, LOG, LOG10, LN, EXP, PI, RAND, RANDBETWEEN, SIGN, TRUNC, SUMPRODUCT, SUMIF, SUMIFS"
    status: completed
  - id: statistical
    content: "Implement Statistical functions: COUNTIF, COUNTIFS, AVERAGEIF, AVERAGEIFS, MEDIAN, MODE, STDEV, VAR, LARGE, SMALL, RANK, PERCENTILE, QUARTILE"
    status: completed
  - id: lookup
    content: "Implement Lookup functions: HLOOKUP, INDEX, MATCH, XLOOKUP, CHOOSE, INDIRECT, OFFSET, ROW, COLUMN, ROWS, COLUMNS"
    status: completed
  - id: text
    content: "Implement Text functions: LEFT, RIGHT, MID, FIND, SEARCH, SUBSTITUTE, REPLACE, TRIM, CLEAN, TEXT, VALUE, EXACT, REPT, PROPER, CHAR, CODE, TEXTJOIN, TEXTBEFORE, TEXTAFTER"
    status: completed
  - id: datetime
    content: "Implement Date/Time functions: TODAY, NOW, DATE, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, DATEVALUE, TIMEVALUE, EDATE, EOMONTH, NETWORKDAYS, WORKDAY, DATEDIF, WEEKDAY, WEEKNUM"
    status: completed
  - id: logical
    content: "Implement Logical functions: IFS, SWITCH, IFERROR, IFNA, ISBLANK, ISERROR, ISNUMBER, ISTEXT"
    status: completed
  - id: financial
    content: "Implement Financial functions: PMT, PV, FV, NPV, IRR, RATE, NPER, SLN, DB"
    status: completed
  - id: information
    content: "Implement Information functions: TYPE, ISLOGICAL, CELL, INFO (ISBLANK, ISERROR, ISNUMBER, ISTEXT already done in Logical phase)"
    status: completed
  - id: build-copy
    content: Build WASM, copy output to all 3 stale locations (media/wasm, wasm-out, media/wasm-out), update formula autocomplete in main.ts, update features.md checkboxes
    status: completed
isProject: false
---

# XLSX Formula Functions Expansion

## Current State

- **File**:
  `[formulas.rs](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/wasm/src/formulas.rs)`
  (1,190 lines)
- **Currently implemented** (17 functions): `SUM`, `AVERAGE`/`AVG`, `COUNT`,
  `COUNTA`, `MIN`, `MAX`, `IF`, `VLOOKUP`, `ABS`, `ROUND`, `LEN`, `UPPER`,
  `LOWER`, `CONCATENATE`/`CONCAT`, `NOT`, `AND`, `OR`
- **Infrastructure already present**: `CellValue` enum, `cv_to_number`,
  `cv_to_string`, `flatten_args`, cross-sheet refs, named ranges, dependency
  graph, caching

## Architecture Decisions

- **No new crate dependencies.** Date serial number math is implemented with
  pure arithmetic (matches Excel's 1900 epoch with the Lotus 1-2-3 leap year
  bug). `js_sys::Date` (already in `Cargo.toml`) provides current date/time for
  `TODAY`/`NOW`.
- **All functions stay as match arms** in `eval_function`. Helper infrastructure
  (criteria matching, date conversion, financial math) is added as private
  standalone functions above `eval_function`.
- **Deduplication**: `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT` appear in both
  Logical and Information lists in the feature doc -- implemented once.

## Helper Infrastructure (added before `eval_function`)

### 1. Criteria Matching Engine

Needed by: `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`

```rust
fn matches_criteria(value: &CellValue, criteria: &CellValue) -> bool
```

Supports:

- Numeric comparison operators: `">5"`, `"<10"`, `">=3"`, `"<=7"`, `"<>0"`
- Wildcard text matching: `"A*"`, `"?est"` (where `*` = any chars, `?` = one
  char)
- Exact text match (case-insensitive)
- Numeric equality

### 2. Date Serial Number Conversion

Needed by: all Date/Time functions

```rust
fn date_to_serial(year: i32, month: i32, day: i32) -> f64
fn serial_to_date(serial: f64) -> (i32, u32, u32)  // (year, month, day)
fn time_to_serial(hour: u32, min: u32, sec: u32) -> f64
fn serial_to_time(serial: f64) -> (u32, u32, u32)  // (hour, min, sec)
fn is_leap_year(year: i32) -> bool
fn days_in_month(year: i32, month: u32) -> u32
```

Excel epoch: serial 1 = Jan 1, 1900. Includes the Lotus 1-2-3 bug (serial 60 =
fake Feb 29, 1900).

### 3. Financial Math Helpers

Needed by: `PMT`, `PV`, `FV`, `NPV`, `IRR`, `RATE`, `NPER`

```rust
fn pmt(rate: f64, nper: f64, pv: f64, fv: f64, pmt_type: i32) -> f64
fn fv_calc(rate: f64, nper: f64, pmt: f64, pv: f64, pmt_type: i32) -> f64
fn newton_raphson_irr(cashflows: &[f64], guess: f64) -> Result<f64, ()>
```

### 4. Helper for conditional range evaluation

Needed by: `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`

```rust
fn eval_range_to_vec(expr: &Expr, ctx: &EvalCtx, ...) -> Vec<(u32, u32, CellValue)>
```

Returns `(row, col, value)` triples so conditional functions can zip criteria
ranges with sum ranges by position.

## Function Implementation by Category

### Phase 1: Simple Math/Trig (19 functions)

`PRODUCT`, `MOD`, `INT`, `CEILING`, `FLOOR`, `POWER`, `SQRT`, `LOG`, `LOG10`,
`LN`, `EXP`, `PI`, `RAND`, `RANDBETWEEN`, `SIGN`, `TRUNC`, `SUMPRODUCT`

Plus criteria infrastructure + conditional aggregates: `SUMIF`, `SUMIFS`

All are straightforward -- single-line to ~15-line match arms using `f64` math
ops. `SUMPRODUCT` zips multiple ranges and multiplies element-wise.

### Phase 2: Statistical (13 functions)

`COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`, `MEDIAN`, `MODE`, `STDEV`,
`VAR`, `LARGE`, `SMALL`, `RANK`, `PERCENTILE`, `QUARTILE`

- `MEDIAN`: sort + middle element
- `MODE`: frequency counting via `HashMap`
- `STDEV`/`VAR`: two-pass (mean, then sum of squared deviations)
- `LARGE`/`SMALL`: sort + index
- `RANK`: count values greater/less
- `PERCENTILE`/`QUARTILE`: interpolation between sorted values

### Phase 3: Lookup (11 functions)

`HLOOKUP`, `INDEX`, `MATCH`, `XLOOKUP`, `CHOOSE`, `INDIRECT`, `OFFSET`, `ROW`,
`COLUMN`, `ROWS`, `COLUMNS`

- `HLOOKUP`: horizontal version of existing `VLOOKUP` logic
- `INDEX`/`MATCH`: core lookup pair, `INDEX` returns value at (row, col) in
  range, `MATCH` finds position
- `XLOOKUP`: modern lookup with match_mode and search_mode params
- `INDIRECT`: parse a string as a cell reference at runtime (volatile)
- `OFFSET`: return a range reference offset from a base (volatile)
- `ROW`/`COLUMN`/`ROWS`/`COLUMNS`: return row/col numbers or range dimensions
- `CHOOSE`: select from a list by index

### Phase 4: Text (19 functions)

`LEFT`, `RIGHT`, `MID`, `FIND`, `SEARCH`, `SUBSTITUTE`, `REPLACE`, `TRIM`,
`CLEAN`, `TEXT`, `VALUE`, `EXACT`, `REPT`, `PROPER`, `CHAR`, `CODE`, `TEXTJOIN`,
`TEXTBEFORE`, `TEXTAFTER`

- Most are simple string operations
- `TEXT`: number formatting with format codes (e.g., `TEXT(1234.5, "#,##0.00")`)
  -- implement a subset of common formats (`0`, `0.00`, `#,##0`, `#,##0.00`,
  `0%`, date formats `yyyy-mm-dd`, `mm/dd/yyyy`)
- `TEXTJOIN`: concat with delimiter, optional skip_empty
- `TEXTBEFORE`/`TEXTAFTER`: Excel 365 functions, find delimiter and return text
  before/after

### Phase 5: Date/Time (18 functions)

`TODAY`, `NOW`, `DATE`, `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`,
`DATEVALUE`, `TIMEVALUE`, `EDATE`, `EOMONTH`, `NETWORKDAYS`, `WORKDAY`,
`DATEDIF`, `WEEKDAY`, `WEEKNUM`

- `TODAY`/`NOW`: use `js_sys::Date::new_0()` to get current date/time, convert
  to serial
- `DATE`/`YEAR`/`MONTH`/`DAY`: use the serial conversion helpers
- `EDATE`/`EOMONTH`: add months to a date serial
- `NETWORKDAYS`/`WORKDAY`: iterate days skipping weekends (no holiday support
  initially)
- `DATEDIF`: difference in years/months/days between two dates
- `WEEKDAY`/`WEEKNUM`: day-of-week and week-of-year from serial

### Phase 6: Logical (8 functions, 4 already partially listed elsewhere)

`IFS`, `SWITCH`, `IFERROR`, `IFNA`, `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT`

- `IFS`: sequential condition checking (like chained IFs)
- `SWITCH`: value matching against cases
- `IFERROR`/`IFNA`: error-trapping wrappers
- `ISBLANK`/`ISERROR`/`ISNUMBER`/`ISTEXT`: type-checking predicates

### Phase 7: Financial (9 functions)

`PMT`, `PV`, `FV`, `NPV`, `IRR`, `RATE`, `NPER`, `SLN`, `DB`

- `PMT`/`PV`/`FV`/`NPER`: closed-form annuity formulas
- `NPV`: discount cash flows
- `IRR`: Newton-Raphson iterative solver (max 100 iterations)
- `RATE`: Newton-Raphson solver for interest rate
- `SLN`: straight-line depreciation `(cost - salvage) / life`
- `DB`: declining balance depreciation

### Phase 8: Information (8 functions, most shared with Logical)

`TYPE`, `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `CELL`, `INFO`

- `TYPE`: returns 1 (number), 2 (text), 4 (logical), 16 (error), 64 (array)
- `ISLOGICAL`: checks if value is boolean
- `CELL`/`INFO`: return `#N/A` (these require deep workbook metadata not
  available in the engine)

## Post-Implementation

- Rebuild WASM: `wasm-pack build --target web` from the `wasm/` directory
- Copy updated `.d.ts`, `.js`, `.wasm` files to `media/wasm/`, `wasm-out/`,
  `media/wasm-out/` (same issue we just fixed)
- Update the formula autocomplete list in
  `[main.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/main.ts)`
  to include the new function names
- Update `[features.md](docs/xlsx-rust-viewer/features.md)` checkboxes to mark
  completed
