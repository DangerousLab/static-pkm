# Markdown Rendering Test 2

This document tests all basic markdown features.

**Anchor link test:** [Jump to Wide Table](#wide-table-overflow-test) · [Jump to Links](#links) · [Jump to XSS Test](#xss-security-test)

## Heading Level 2

Text formatting includes **bold text**, *italic text*, and ***bold italic***.

### Heading Level 3

You can also use **bold with underscores** and *italic with underscores*.

#### Heading Level 4

Inline code looks like this: `const x = 42;`

##### Heading Level 5

###### Heading Level 6

---

## Code Blocks

Fenced code block:

```
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet("World"));
```

Indented code block:

```
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

---

## Lists

### Unordered List

- First item
- Second item
- Third item
  - Nested item 1
  - Nested item 2
    - Deeply nested item

### Ordered List

1. First step
2. Second step
3. Third step
   1. Sub-step A
   2. Sub-step B

### Mixed List

1. Ordered item
   - Unordered nested
   - Another unordered
2. Back to ordered

---

## Links

[External link to GitHub](https://github.com)

Automatic link: <https://www.example.com>

---

## Blockquotes

> This is a single-line blockquote.

> This is a multi-line blockquote.\
> It continues on the next line.\
> And even more lines.

> Nested blockquotes:
>
> > This is nested
> >
> > > And this is double-nested

---

## Horizontal Rules

Three different syntaxes:

---

---

---

## Paragraphs

This is the first paragraph. It contains multiple sentences to demonstrate text flow. Paragraphs are separated by blank lines.

This is the second paragraph. Notice the spacing between paragraphs.

This is the third paragraph with some **bold**, *italic*, and `inline code` mixed in.

---

## Combinations

You can combine **bold and** `code` or *italic and **bold italic*** in interesting ways.

> Blockquote with **bold text**, *italic text*, and `inline code`.

1. Ordered list with **bold**
2. And *italic*
3. And `code`

- Unordered list with [a link](https://example.com)
- And **bold text**

---

## Wide Table Overflow Test

This table has many columns and should scroll horizontally within its own box without affecting the card width:

| Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 | Col 9 | Col 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Alpha | Beta | Gamma | Delta | Epsilon | Zeta | Eta | Theta | Iota | Kappa |
| One | Two | Three | Four | Five | Six | Seven | Eight | Nine | Ten |
| Lorem | Ipsum | Dolor | Sit | Amet | Consectetur | Adipiscing | Elit | Sed | Do |

---

## XSS Security Test

The following should NOT execute (script tags removed by DOMPurify):

&lt;script&gt;alert('XSS Attack');&lt;/script&gt;

&lt;img src="x" onerror="alert('XSS')"&gt;

\[Click me\](javascript:alert('XSS'))

---

## End of Test Document

If you can read this with proper formatting, basic markdown rendering is working!