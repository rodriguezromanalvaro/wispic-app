// Progressive bridge for Tamagui primitives with a safe fallback.
// - If 'tamagui' is installed, we use it to unlock shorthands/tokens fully.
// - Otherwise, fall back to '@tamagui/stacks' or plain RN so the app compiles and runs.
// Additionally, we guard against early renders before TamaguiProvider config is set by
// dynamically resolving to RN primitives until configured, then delegating to Tamagui.
import React from 'react';

let lib: any;
const RN: any = require('react-native');
try {
	// Prefer the meta package when available (enables fully-typed shorthands)
	lib = require('tamagui');
	// Handle potential ESM default wrapper
	if (lib && lib.default && !lib.YStack && lib.default.YStack) {
		lib = lib.default;
	}
} catch {
	// Fallback to stacks-only runtime if meta package not installed yet
	lib = require('@tamagui/stacks');
	if (lib && lib.default && !lib.YStack && lib.default.YStack) {
		lib = lib.default;
	}
}

// Export minimal primitives we use widely. They are typed as any here to avoid TS
// friction during migration when only stacks are present or when meta exports differ.
const getConfig = (): any => {
	try {
		if (!lib) return false;
		// Tamagui exposes getSetting('config') / getTamagui() depending on version/build
		return (lib as any).getSetting?.('config') || (lib as any).getTamagui?.();
	} catch {
		return null;
	}
};

const isConfigured = (): boolean => !!getConfig();

const resolveToken = (val: any, kind: 'space' | 'radius' | 'color'): any => {
	if (val == null) return val;
	if (typeof val === 'string' && val.startsWith('$')) {
		const key = val.slice(1);
		const cfg = getConfig();
		const set = cfg?.tokens?.[kind];
		return set?.[key] ?? val;
	}
	return val;
};

const sanitizePropsForRN = (props: any): any => {
	// Translate common Tamagui shorthands into RN styles on fallback
	const {
		p, px, py, pt, pb, pl, pr,
		m, mx, my, mt, mb, ml, mr,
		gap,
		br,
			bg,
		backgroundColor,
		borderColor,
		color,
			ai,
			jc,
			fd,
			f,
			w,
			h,
			maw,
			mah,
			miw,
			mih,
			ov,
			pos,
			t,
			r,
			b,
			l,
		style,
		...rest
	} = props || {};

	const extra: any = {};
	if (p != null) extra.padding = resolveToken(p, 'space');
	if (px != null) extra.paddingHorizontal = resolveToken(px, 'space');
	if (py != null) extra.paddingVertical = resolveToken(py, 'space');
	if (pt != null) extra.paddingTop = resolveToken(pt, 'space');
	if (pb != null) extra.paddingBottom = resolveToken(pb, 'space');
	if (pl != null) extra.paddingLeft = resolveToken(pl, 'space');
	if (pr != null) extra.paddingRight = resolveToken(pr, 'space');

	if (m != null) extra.margin = resolveToken(m, 'space');
	if (mx != null) extra.marginHorizontal = resolveToken(mx, 'space');
	if (my != null) extra.marginVertical = resolveToken(my, 'space');
	if (mt != null) extra.marginTop = resolveToken(mt, 'space');
	if (mb != null) extra.marginBottom = resolveToken(mb, 'space');
	if (ml != null) extra.marginLeft = resolveToken(ml, 'space');
	if (mr != null) extra.marginRight = resolveToken(mr, 'space');

	if (gap != null) extra.gap = resolveToken(gap, 'space');
	if (br != null) extra.borderRadius = resolveToken(br, 'radius');
	const bgResolved = bg ?? backgroundColor;
	if (bgResolved != null) extra.backgroundColor = resolveToken(bgResolved, 'color');
	if (borderColor != null) extra.borderColor = resolveToken(borderColor, 'color');
	if (color != null) extra.color = resolveToken(color, 'color');

		// Layout shorthands
		if (ai != null) extra.alignItems = ai;
		if (jc != null) extra.justifyContent = jc;
		if (fd != null) extra.flexDirection = fd;
		if (f != null) extra.flex = f;
		if (w != null) extra.width = w;
		if (h != null) extra.height = h;
		if (maw != null) extra.maxWidth = maw;
		if (mah != null) extra.maxHeight = mah;
		if (miw != null) extra.minWidth = miw;
		if (mih != null) extra.minHeight = mih;
		if (ov != null) extra.overflow = ov;
		if (pos != null) extra.position = pos;
		if (t != null) extra.top = t;
		if (r != null) extra.right = r;
		if (b != null) extra.bottom = b;
		if (l != null) extra.left = l;

	// Remove tamagui-only props from rest
	const cleaned = { ...rest } as any;
	return {
		...cleaned,
		style: [style, extra].filter(Boolean),
	};
};

const resolveStack = (name: 'Stack' | 'YStack' | 'XStack'): any => {
	const C = (lib && (lib as any)[name]) || RN?.View;
	// If not configured yet, render RN.View to avoid runtime crash; once configured, Tamagui will render on next pass
	return isConfigured() ? C : RN?.View;
};

export const Stack: any = (props: any) => {
	const Comp: any = resolveStack('Stack');
	const p = isConfigured() ? props : sanitizePropsForRN(props);
	return React.createElement(Comp, p);
};
export const YStack: any = (props: any) => {
	const Comp: any = resolveStack('YStack');
	const p = isConfigured() ? props : sanitizePropsForRN(props);
	return React.createElement(Comp, p);
};
export const XStack: any = (props: any) => {
	const Comp: any = resolveStack('XStack');
	const p = isConfigured() ? props : sanitizePropsForRN(props);
	return React.createElement(Comp, p);
};

export const Text: any = (props: any) => {
	const T: any = (lib && (lib as any).Text && isConfigured()) ? (lib as any).Text : RN?.Text || RN?.TextInput;
	const p = isConfigured() ? props : sanitizePropsForRN(props);
	return React.createElement(T, p);
};
export const Button: any = (props: any) => {
	const B: any = (lib && (lib as any).Button && isConfigured()) ? (lib as any).Button : RN?.Pressable || RN?.TouchableOpacity || RN?.View;
	const p = isConfigured() ? props : sanitizePropsForRN(props);
	return React.createElement(B, p);
};

// Note: TamaguiProvider is configured in app/_layout.tsx (lib/tamagui config)
// See docs/tamagui-migration.md for the final step of switching to 'tamagui' everywhere.
