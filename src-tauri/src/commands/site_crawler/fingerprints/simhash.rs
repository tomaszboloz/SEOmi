use super::*;

pub(in crate::commands::site_crawler) fn content_simhash(document: &Html) -> Option<String> {
    let words = semantic_content_text(document)
        .split_whitespace()
        .map(|word| word.to_ascii_lowercase())
        .collect::<Vec<_>>();
    if words.is_empty() {
        return None;
    }
    let features = if words.len() >= 3 {
        words
            .windows(3)
            .map(|window| window.join(" "))
            .collect::<Vec<_>>()
    } else {
        words
    };
    let mut weights = [0i32; 64];
    for feature in features {
        let digest = Sha256::digest(feature.as_bytes());
        let bits = u64::from_be_bytes(
            digest[..8]
                .try_into()
                .expect("SHA-256 always has at least 8 bytes"),
        );
        for (bit, weight) in weights.iter_mut().enumerate() {
            if bits & (1u64 << bit) == 0 {
                *weight -= 1;
            } else {
                *weight += 1;
            }
        }
    }
    let value = weights
        .iter()
        .enumerate()
        .fold(0u64, |value, (bit, weight)| {
            if *weight >= 0 {
                value | (1u64 << bit)
            } else {
                value
            }
        });
    Some(format!("{value:016x}"))
}

pub(in crate::commands::site_crawler) fn simhash_distance(left: &str, right: &str) -> Option<u32> {
    let left = u64::from_str_radix(left, 16).ok()?;
    let right = u64::from_str_radix(right, 16).ok()?;
    Some((left ^ right).count_ones())
}

pub(in crate::commands::site_crawler) fn near_duplicate_pairs(
    signatures: &[(usize, String)],
) -> Vec<(usize, usize, u32)> {
    const MAX_DISTANCE: u32 = 7;
    let parsed = signatures
        .iter()
        .filter_map(|(index, signature)| {
            u64::from_str_radix(signature, 16)
                .ok()
                .map(|value| (*index, value))
        })
        .collect::<Vec<_>>();
    let mut buckets: std::collections::HashMap<(usize, u8), Vec<(usize, u64)>> =
        std::collections::HashMap::new();
    let mut pairs = HashSet::new();
    for (index, signature) in parsed {
        for band in 0..8 {
            let key = (band, ((signature >> (band * 8)) & 0xff) as u8);
            for (candidate_index, candidate_signature) in buckets.entry(key).or_default().iter() {
                let (left, right) = if index < *candidate_index {
                    (index, *candidate_index)
                } else {
                    (*candidate_index, index)
                };
                if (signature ^ *candidate_signature).count_ones() <= MAX_DISTANCE {
                    pairs.insert((left, right));
                }
            }
            buckets.entry(key).or_default().push((index, signature));
        }
    }
    let mut result = pairs
        .into_iter()
        .filter_map(|(left, right)| {
            let left_signature = signatures
                .iter()
                .find_map(|(index, signature)| (*index == left).then_some(signature))?;
            let right_signature = signatures
                .iter()
                .find_map(|(index, signature)| (*index == right).then_some(signature))?;
            simhash_distance(left_signature, right_signature)
                .map(|distance| (left, right, distance))
        })
        .collect::<Vec<_>>();
    result.sort_by_key(|(left, right, _)| (*left, *right));
    result
}
