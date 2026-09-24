interface MobileSubTabsProps<T extends string> {
  options: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}

/** Segmented control shown only under the sticky chart on mobile (see .page-subtabs in index.css) -
 *  desktop keeps showing inputs/goals/results all at once, so this has no effect there. */
export function MobileSubTabs<T extends string>({ options, active, onSelect }: Readonly<MobileSubTabsProps<T>>) {
  return (
    <div className="page-subtabs">
      {options.map((option) => (
        <div
          key={option.id}
          className={option.id === active ? 'page-subtabs__item page-subtabs__item--active' : 'page-subtabs__item'}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}
