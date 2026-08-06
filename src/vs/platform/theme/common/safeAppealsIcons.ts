/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../base/common/codicons.js';
import { localize } from '../../../nls.js';
import { registerIcon } from './iconRegistry.js';

export const safeAppealsShieldOutlineIcon = registerIcon(
	'safeappeals-shield-outline',
	Codicon.shield,
	localize('safeAppealsShieldOutline', 'SafeAppeals shield outline icon.')
);
