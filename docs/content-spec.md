# Problem Content Format Specification

Source of truth for all content in `data/problems/*.json`.
Content is rendered by `packages/shared/src/renderers/` for each platform.

## Source Format

All prose fields (`explanation`, `complexity_analysis`, `alternative_approaches`, `follow_up`)
are **standard GitHub Flavored Markdown (GFM)**. The `pseudocode` field is **plain text**.

## Math Notation

Never use LaTeX (`\(n^2\)`, `$n^2$`) or raw caret notation (`n^2`).
Use Unicode math characters — they render identically on web, Telegram, and any terminal.

### Superscripts
| Write | Instead of |
|-------|-----------|
| `n²`  | `n^2`     |
| `n³`  | `n^3`     |
| `n⁴`  | `n^4`     |
| `2ⁿ`  | `2^n`     |
| `kⁿ`  | `k^n`     |

Common Unicode superscripts: ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁿ

### Subscripts (mathematical notation only)
| Write  | Instead of | When to use |
|--------|-----------|-------------|
| `Cₙ`   | `C_n`     | Catalan number or math variable |
| `xₙ`   | `x_n`     | Sequence element |
| `aᵢ`   | `a_i`     | Array element with index i |

Common Unicode subscripts: ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ ₙ ᵢ ⱼ ₖ

**Do NOT convert code variable names** — `n_tasks`, `box_id`, `effective_k`,
`left_ptr` are snake_case identifiers and must stay as-is.

## Markdown Rules (prose fields)

```markdown
## Section heading     ← H2 max; use for main sections
**key term**           ← bold for emphasis and important terms
*term*                 ← italic for introduced terms
`variable_name`        ← inline code for all identifiers, constants, functions
```cpp                 ← fenced code block with language tag
O(n²)                  ← Big-O uses Unicode superscripts
```

- No raw HTML tags in source (e.g. no `<sub>`, `<sup>`, `<br>`)
- C++ constants like `INT_MAX`, `INT_MIN` must be in backticks: `` `INT_MAX` ``

## Pseudocode Field

Stored as **plain text** — no Markdown syntax.

```
✅ Allowed:
  -> (arrow)
  [] {} () (brackets)
  // (comment)
  snake_case variable names: left_ptr, max_area, prev_node
  ASCII comparison: >, <, >=, <=, ==, !=
  indentation with spaces

❌ Not allowed:
  **bold**  →  remove the **
  *italic*  →  remove the *
  ## heading  →  remove the ##
  `backtick`  →  remove the backticks (pseudocode is not Markdown)
```

## Platform Rendering Matrix

| Field                  | Web              | Telegram               |
|------------------------|------------------|------------------------|
| explanation            | ReactMarkdown    | TelegramHtmlRenderer   |
| complexity_analysis    | ReactMarkdown    | TelegramHtmlRenderer   |
| pseudocode             | `<pre>` verbatim | `<pre>` via renderer   |
| alternative_approaches | ReactMarkdown    | TelegramHtmlRenderer   |
| follow_up              | ReactMarkdown    | TelegramHtmlRenderer   |
