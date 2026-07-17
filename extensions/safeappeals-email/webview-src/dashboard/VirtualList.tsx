import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';

interface VirtualListProps<T> {
	items: T[];
	itemHeight: number;
	height: number;
	renderItem: (item: T, index: number) => React.ReactNode;
	overscan?: number;
}

/**
 * Simple windowed list — only mounts visible rows (+ overscan).
 */
export function VirtualList<T>({
	items,
	itemHeight,
	height,
	renderItem,
	overscan = 6,
}: VirtualListProps<T>): React.ReactElement {
	const ref = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);

	const onScroll = useCallback(() => {
		if (ref.current) {
			setScrollTop(ref.current.scrollTop);
		}
	}, []);

	useEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}
		el.addEventListener('scroll', onScroll, { passive: true });
		return () => el.removeEventListener('scroll', onScroll);
	}, [onScroll]);

	const { start, end, offsetY } = useMemo(() => {
		const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
		const visible = Math.ceil(height / itemHeight) + overscan * 2;
		const endIdx = Math.min(items.length, startIdx + visible);
		return { start: startIdx, end: endIdx, offsetY: startIdx * itemHeight };
	}, [scrollTop, itemHeight, height, items.length, overscan]);

	const slice = items.slice(start, end);
	const totalHeight = items.length * itemHeight;

	return (
		<div ref={ref} className="vlist" style={{ height }}>
			<div className="vlist-spacer" style={{ height: totalHeight }}>
				<div className="vlist-window" style={{ transform: `translateY(${offsetY}px)` }}>
					{slice.map((item, i) => (
						<div key={start + i} className="vlist-row" style={{ height: itemHeight }}>
							{renderItem(item, start + i)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
