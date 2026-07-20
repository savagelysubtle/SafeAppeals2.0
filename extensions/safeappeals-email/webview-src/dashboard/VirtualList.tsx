import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';

interface VirtualListProps<T> {
	items: T[];
	itemHeight: number;
	/** Fixed height in px. When omitted, fills the parent and measures via ResizeObserver. */
	height?: number;
	/** Bump to force a remeasure (e.g. after sash drag ends). */
	remeasureKey?: number;
	renderItem: (item: T, index: number) => React.ReactNode;
	overscan?: number;
}

/**
 * Simple windowed list — only mounts visible rows (+ overscan).
 * When `height` is omitted, the list fills its parent and tracks size with ResizeObserver.
 */
export function VirtualList<T>({
	items,
	itemHeight,
	height: heightProp,
	remeasureKey = 0,
	renderItem,
	overscan = 6,
}: VirtualListProps<T>): React.ReactElement {
	const ref = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [measuredHeight, setMeasuredHeight] = useState(heightProp ?? 240);

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

	useEffect(() => {
		if (heightProp !== undefined) {
			setMeasuredHeight(heightProp);
			return;
		}
		const el = ref.current;
		if (!el) {
			return;
		}
		const measure = () => {
			const h = el.clientHeight;
			if (h > 0) {
				setMeasuredHeight(h);
			}
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [heightProp, remeasureKey]);

	const height = heightProp ?? measuredHeight;

	const { start, end, offsetY } = useMemo(() => {
		const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
		const visible = Math.ceil(height / itemHeight) + overscan * 2;
		const endIdx = Math.min(items.length, startIdx + visible);
		return { start: startIdx, end: endIdx, offsetY: startIdx * itemHeight };
	}, [scrollTop, itemHeight, height, items.length, overscan]);

	const slice = items.slice(start, end);
	const totalHeight = items.length * itemHeight;
	const fillParent = heightProp === undefined;

	return (
		<div
			ref={ref}
			className={`vlist${fillParent ? ' vlist-fill' : ''}`}
			style={fillParent ? undefined : { height }}
		>
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
