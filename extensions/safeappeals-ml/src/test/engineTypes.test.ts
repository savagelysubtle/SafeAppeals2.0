/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { peakRssBudgetFromTotalRamMb } from '../engineTypes';

suite('engineTypes', () => {
	test('peakRssBudgetFromTotalRamMb clamps to laptop-friendly range', () => {
		assert.deepStrictEqual(
			{
				zero: peakRssBudgetFromTotalRamMb(0),
				negative: peakRssBudgetFromTotalRamMb(-512),
				fourGb: peakRssBudgetFromTotalRamMb(4096),
				thirtyTwoGb: peakRssBudgetFromTotalRamMb(32_768),
			},
			{
				zero: 2048,
				negative: 2048,
				fourGb: 1024,
				thirtyTwoGb: 4096,
			},
		);
	});
});
