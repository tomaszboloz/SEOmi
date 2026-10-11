# PDF fonts

The bundled PDF fonts are from the Noto projects and are distributed under
the SIL Open Font License 1.1. The complete license text is kept next to each
family so the application can redistribute the embedded font data.

- `NotoSans-Regular.ttf`: Latin, extended Latin, Greek and Cyrillic.
- `NotoSansArabic-Regular.ttf`: Arabic glyphs used after Rustybuzz shaping.
- `NotoSansCJKsc-Regular.otf`: Chinese, Japanese, Korean and Cyrillic fallback.

The PDF writer embeds only the font resources used by a report. Unsupported
emoji and scripts remain an explicit `?` rather than claiming an unavailable
glyph. Arabic output is shaped with Rustybuzz in right-to-left runs; complex
mixed-script bidi layout remains outside this small PDF writer.
