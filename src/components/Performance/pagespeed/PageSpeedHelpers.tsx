import React from "react";

export const renderLighthouseDescription = (description: string): React.ReactNode => {
  const parts = description.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    return match
      ? <a key={index} href={match[2]} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{match[1]}</a>
      : <React.Fragment key={index}>{part}</React.Fragment>;
  });
};
