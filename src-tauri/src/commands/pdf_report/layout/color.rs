#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgb(pub u8, pub u8, pub u8);

pub const BRAND: Rgb = Rgb(0x4F, 0x46, 0xE5);
pub const CRITICAL: Rgb = Rgb(0xDC, 0x26, 0x26);
pub const WARNING: Rgb = Rgb(0xD9, 0x77, 0x06);
pub const INFO: Rgb = Rgb(0x25, 0x63, 0xEB);
pub const OK: Rgb = Rgb(0x16, 0xA3, 0x4A);
pub const TEXT: Rgb = Rgb(0x1F, 0x29, 0x37);
pub const MUTED: Rgb = Rgb(0x6B, 0x72, 0x80);
pub const RULE: Rgb = Rgb(0xE5, 0xE7, 0xEB);
pub const ZEBRA: Rgb = Rgb(0xF9, 0xFA, 0xFB);
pub const PANEL: Rgb = Rgb(0xF3, 0xF4, 0xF6);
pub const WHITE: Rgb = Rgb(0xFF, 0xFF, 0xFF);

impl Rgb {
    fn channels(self) -> String {
        let part = |value: u8| format!("{:.3}", f32::from(value) / 255.0);
        format!("{} {} {}", part(self.0), part(self.1), part(self.2))
    }

    pub fn fill_op(self) -> String {
        format!("{} rg\n", self.channels())
    }

    pub fn stroke_op(self) -> String {
        format!("{} RG\n", self.channels())
    }

    /// Mixes the colour with white; `share` is the white portion (0.0 to 1.0).
    pub fn tint(self, share: f32) -> Rgb {
        let mix = |value: u8| (f32::from(value) * (1.0 - share) + 255.0 * share).round() as u8;
        Rgb(mix(self.0), mix(self.1), mix(self.2))
    }
}
