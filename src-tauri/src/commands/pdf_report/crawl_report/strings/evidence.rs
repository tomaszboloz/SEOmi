macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.evidence.title",
    INTRO => "crawl.evidence.intro",
    T_REVENUE => "crawl.evidence.tRevenue",
    REVENUE_INTRO => "crawl.evidence.revenueIntro",
    COL_PAGE => "crawl.evidence.colPage",
    COL_REVENUE => "crawl.evidence.colRevenue",
    T_EXPERIMENTS => "crawl.evidence.tExperiments",
    EXPERIMENTS_INTRO => "crawl.evidence.experimentsIntro",
    COL_TARGET => "crawl.evidence.colTarget",
    COL_DATE => "crawl.evidence.colDate",
    COL_METHOD => "crawl.evidence.colMethod",
    COL_STATUS => "crawl.evidence.colStatus",
    COL_OUTCOME => "crawl.evidence.colOutcome",
    COL_EFFECT => "crawl.evidence.colEffect",
    COL_PROBABILITY => "crawl.evidence.colProbability",
    T_DECAY => "crawl.evidence.tDecay",
    DECAY_INTRO => "crawl.evidence.decayIntro",
    COL_QUERY => "crawl.evidence.colQuery",
    COL_VERDICT => "crawl.evidence.colVerdict",
    COL_SAMPLES => "crawl.evidence.colSamples",
    COL_SHIFT => "crawl.evidence.colShift",
    COL_ENTITIES => "crawl.evidence.colEntities",
    NA => "crawl.evidence.na",
    DISCLAIMER => "crawl.evidence.disclaimer",
}

pub const STATUS: &str = "crawl.evidence.status";
pub const VERDICT: &str = "crawl.evidence.verdict";
pub const METHOD: &str = "crawl.evidence.method";
pub const OUTCOME: &str = "crawl.evidence.outcome";
