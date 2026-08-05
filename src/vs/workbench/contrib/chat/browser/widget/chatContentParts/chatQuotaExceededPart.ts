/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../../base/browser/dom.js';
import { Button } from '../../../../../../base/browser/ui/button/button.js';
import { WorkbenchActionExecutedClassification, WorkbenchActionExecutedEvent } from '../../../../../../base/common/actions.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { Disposable, IDisposable } from '../../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { assertType } from '../../../../../../base/common/types.js';
import { IMarkdownRenderer } from '../../../../../../platform/markdown/browser/markdownRenderer.js';
import { localize } from '../../../../../../nls.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import product from '../../../../../../platform/product/common/product.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles } from '../../../../../../platform/theme/browser/defaultStyles.js';
import { IAuthenticationService } from '../../../../../services/authentication/common/authentication.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../../../services/chat/common/chatEntitlementService.js';
import { openSafeAppealsCreditsCheckout, SAFEAPPEALS_OPEN_CHECKOUT_COMMAND, usesSafeAppealsCloudSetup } from '../../../common/chatSetupCloudHelpers.js';
import { ILanguageModelsService } from '../../../common/languageModels.js';
import { IChatErrorDetailsPart, IChatRendererContent, IChatResponseViewModel } from '../../../common/model/chatViewModel.js';
import { IChatContentPart } from './chatContentParts.js';

const $ = dom.$;

const defaultChat = product.defaultChatAgent;

export class ChatQuotaExceededPart extends Disposable implements IChatContentPart {

	readonly domNode: HTMLElement;

	constructor(
		element: IChatResponseViewModel,
		private readonly content: IChatErrorDetailsPart,
		renderer: IMarkdownRenderer,
		@ICommandService commandService: ICommandService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IChatEntitlementService chatEntitlementService: IChatEntitlementService,
		@ILanguageModelsService languageModelsService: ILanguageModelsService,
		@IAuthenticationService authenticationService: IAuthenticationService,
		@IOpenerService openerService: IOpenerService,
	) {
		super();

		const errorDetails = element.errorDetails;
		assertType(!!errorDetails, 'errorDetails');

		this.domNode = $('.chat-quota-error-widget');
		const icon = dom.append(this.domNode, $('span'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));

		const usesCloudSetup = usesSafeAppealsCloudSetup({
			getVendors: () => languageModelsService.getVendors(),
			hasByokModels: chatEntitlementService.hasByokModels,
			isAuthenticationProviderRegistered: (id) => authenticationService.isAuthenticationProviderRegistered(id),
		});

		const messageContainer = dom.append(this.domNode, $('.chat-quota-error-message'));
		const displayMessage = usesCloudSetup
			? localize('safeAppealsCreditsQuotaExceededInline', "You need SafeAppeals credits to continue.")
			: errorDetails.message;
		const markdownContent = this._register(renderer.render(new MarkdownString(displayMessage)));
		dom.append(messageContainer, markdownContent.element);

		let primaryButtonLabel: string | undefined;
		if (usesCloudSetup) {
			primaryButtonLabel = localize('addCredits', "Add Credits");
		} else {
			switch (chatEntitlementService.entitlement) {
				case ChatEntitlement.EDU:
				case ChatEntitlement.Pro:
				case ChatEntitlement.ProPlus:
				case ChatEntitlement.Max:
					primaryButtonLabel = localize('manageBudget', "Manage Budget");
					break;
				case ChatEntitlement.Free:
					primaryButtonLabel = localize('upgradeToCopilotPro', "Upgrade to GitHub Copilot Pro");
					break;
			}
		}

		if (primaryButtonLabel) {
			const primaryButton = this._register(new Button(messageContainer, { ...defaultButtonStyles, supportIcons: true }));
			primaryButton.label = primaryButtonLabel;
			primaryButton.element.classList.add('chat-quota-error-button');

			this._register(primaryButton.onDidClick(async () => {
				if (usesCloudSetup) {
					telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: SAFEAPPEALS_OPEN_CHECKOUT_COMMAND, from: 'chat-response' });
					await openSafeAppealsCreditsCheckout(commandService, openerService, defaultChat?.upgradePlanUrl);
					return;
				}
				const commandId = chatEntitlementService.entitlement === ChatEntitlement.Free ? 'workbench.action.chat.upgradePlan' : 'workbench.action.chat.manageAdditionalSpend';
				telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: commandId, from: 'chat-response' });
				await commandService.executeCommand(commandId);
			}));
		}
	}

	hasSameContent(other: IChatRendererContent): boolean {
		return other.kind === this.content.kind && !!other.errorDetails.isQuotaExceeded;
	}

	addDisposable(disposable: IDisposable): void {
		this._register(disposable);
	}
}
