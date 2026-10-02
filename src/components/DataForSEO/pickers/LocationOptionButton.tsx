import React from 'react';
import { Check } from 'lucide-react';
import { DataForSeoMarket, dataForSeoMarketLabel } from '@/services/dataforseo';

interface LocationOptionButtonProps {
  item: DataForSeoMarket;
  id: string;
  isSelected: boolean;
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

export const LocationOptionButton: React.FC<LocationOptionButtonProps> = ({
  item,
  id,
  isSelected,
  isActive,
  onMouseEnter,
  onClick,
}) => {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${
        isActive
          ? 'bg-emerald-500/10 text-white'
          : 'text-slate-300 hover:bg-slate-800'
      }`}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span className="truncate">
        {dataForSeoMarketLabel(item)}{' '}
        <span className="text-slate-500">
          ({item.code}) · {item.locationCode}
        </span>
      </span>
      {isSelected ? (
        <Check
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-emerald-400"
        />
      ) : null}
    </button>
  );
};
