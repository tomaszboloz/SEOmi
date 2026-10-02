import type { CrawledPageSummary } from "@/types";
import { formatNumber } from './crawlResultsHelpers';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const socialResourceStatus = (
  check: NonNullable<
    CrawledPageSummary["favicon_resource_checks"]
  >[number],
  t: Translate,
): string => {
  if (!check.checked_in_run) return t("crawl.social.notChecked");
  if (check.request_error_kind)
    return t("crawl.social.requestError", {
      kind: check.request_error_kind,
    });
  return [
    check.http_status == null
      ? t("crawl.social.noHttpStatus")
      : t("crawl.ui.httpStatus", { status: check.http_status }),
    check.content_length == null
      ? null
      : `${formatNumber(check.content_length)} B`,
    check.intrinsic_width && check.intrinsic_height
      ? `${check.intrinsic_width} × ${check.intrinsic_height} · ${check.dimensions_source || t("crawl.social.intrinsic")}`
      : null,
    check.content_type || null,
  ]
    .filter(Boolean)
    .join(" · ");
};

export const SocialTagList = ({ page, prefix, t }: { page: CrawledPageSummary; prefix: "og:" | "twitter:"; t: Translate }) => {
  const tags = (page.social_meta_tags || []).filter((tag) =>
    tag.key.startsWith(prefix),
  );
  return tags.length ? (
    <div className="max-w-[420px] space-y-2">
      {tags.map((tag, index) => (
        <div key={`${tag.key}-${index}`} className="break-words">
          <p>
            <span className="font-mono text-slate-500">
              {tag.key}:{" "}
            </span>
            {tag.content === undefined || tag.content === null ? (
              <span className="italic text-amber-300">
                {t("crawl.social.missingContent")}
              </span>
            ) : tag.content === "" ? (
              <span className="italic text-amber-300">
                {t("crawl.social.emptyContent")}
              </span>
            ) : (
              tag.content
            )}
          </p>
          {tag.resource_check && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {socialResourceStatus(tag.resource_check, t)}
            </p>
          )}
        </div>
      ))}
    </div>
  ) : (
    <span className="text-slate-500">
      {t("crawl.social.noDeclaration")}
    </span>
  );
};
