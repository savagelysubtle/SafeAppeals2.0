/*--------------------------------------------------------------------------------------
 *  Classifier seam — AI classification deferred to rung 12 (needs vscode.lm)
 *
 *  Old fork: void-reference/browser/emailClassifier.ts called Cloud LLM router.
 *  Call sites after sync / parse should invoke `classifyMessageHook` so rung 12
 *  can swap in a real LM-backed implementation without chasing call sites.
 *--------------------------------------------------------------------------------------*/

import type { EmailClassification, EmailMessageSummary } from './types';

export interface ClassifierHook {
	/**
	 * Classify a message. Returns null when classification is unavailable
	 * (current no-op until rung 12).
	 */
	classifyMessage(summary: EmailMessageSummary): Promise<EmailClassification | null>;

	/** Whether a real LM classifier is wired. Always false until rung 12. */
	isAvailable(): boolean;
}

/**
 * TODO(rung12): Replace with vscode.lm-backed classifier (see void-reference
 * emailClassifier.ts for prompt shape + category/priority validation).
 */
export const noopClassifierHook: ClassifierHook = {
	async classifyMessage(_summary: EmailMessageSummary): Promise<EmailClassification | null> {
		// TODO(rung12): invoke LM; persist via emailIndex.updateClassification
		return null;
	},
	isAvailable(): boolean {
		return false;
	},
};

/**
 * After headers are indexed, run the classifier hook (no-op today).
 * Rung 12 will make this enqueue LM work.
 */
export async function runClassifierOnNewMessages(
	messages: EmailMessageSummary[],
	hook: ClassifierHook = noopClassifierHook,
): Promise<void> {
	if (!hook.isAvailable()) {
		return;
	}
	for (const msg of messages) {
		if (msg.classifiedAt) {
			continue;
		}
		await hook.classifyMessage(msg);
	}
}
