/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccessor, useIsDark } from '../util/services.js';
import { EmailToolbar, EmailViewMode, EmailSortField, EmailSortDirection } from './EmailToolbar.js';
import { EmailCard } from './EmailCard.js';
import { EmailFilters } from './EmailFilters.js';
import { Email } from '../../../../common/emailService.js';

// SafeAppeals brand colors (matching TimelineDashboard)
const BRAND_GREEN = '#22c55e';

export const EmailDashboard: React.FC = () => {
	const accessor = useAccessor();
	const isDark = useIsDark();

	const [emails, setEmails] = useState<Email[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCaseFolder, setSelectedCaseFolder] = useState<string | 'all'>('all');
	const [caseFolders, setCaseFolders] = useState<string[]>([]);
	const [viewMode, setViewMode] = useState<EmailViewMode>('list');
	const [sortField, setSortField] = useState<EmailSortField>('date');
	const [sortDirection, setSortDirection] = useState<EmailSortDirection>('desc');
	const [showFilters, setShowFilters] = useState(false);

	// Load emails on mount
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true);
			try {
				const emailService = accessor.get('IEmailService');
				const loadedEmails = await emailService.getEmails();
				setEmails(loadedEmails);

				// Get unique case folders
				const stats = await emailService.getStats();
				setCaseFolders(stats.caseFolders);
			} catch (error) {
				console.error('[EmailDashboard] Failed to load emails:', error);
				// Service might not be ready, or emails table is empty
				setEmails([]);
				setCaseFolders([]);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only run on mount - accessor is stable

	const handleImportEmail = useCallback(async () => {
		try {
			const fileDialogService = accessor.get('IFileDialogService');
			const emailService = accessor.get('IEmailService');

			const result = await fileDialogService.showOpenDialog({
				title: 'Import Email',
				filters: [
					{ name: 'Email Files', extensions: ['eml', 'pdf'] },
					{ name: 'EML Files', extensions: ['eml'] },
					{ name: 'PDF Files', extensions: ['pdf'] }
				],
				canSelectMany: true
			});

			if (result && result.length > 0) {
				for (const uri of result) {
					await emailService.parseEmail(uri);
				}
				// Refresh email list
				const loadedEmails = await emailService.getEmails();
				setEmails(loadedEmails);
				const stats = await emailService.getStats();
				setCaseFolders(stats.caseFolders);
			}
		} catch (error) {
			console.error('[EmailDashboard] Failed to import email:', error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleOpenEmail = useCallback(async (email: Email) => {
		try {
			const editorService = accessor.get('IEditorService');
			const URI = accessor.get('URI');
			const uri = URI.file(email.filePath);
			await editorService.openEditor({ resource: uri });
		} catch (error) {
			console.error('[EmailDashboard] Failed to open email:', error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleDeleteEmail = useCallback(async (emailId: string) => {
		try {
			const emailService = accessor.get('IEmailService');
			await emailService.deleteEmail(emailId);
			setEmails(prev => prev.filter(e => e.id !== emailId));
		} catch (error) {
			console.error('[EmailDashboard] Failed to delete email:', error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleSearch = useCallback(async (query: string) => {
		setSearchQuery(query);
		if (!query.trim()) {
			// Reset to all emails
			const emailService = accessor.get('IEmailService');
			const loadedEmails = await emailService.getEmails();
			setEmails(loadedEmails);
			return;
		}

		try {
			const emailService = accessor.get('IEmailService');
			const results = await emailService.searchEmails(query);
			setEmails(results);
		} catch (error) {
			console.error('[EmailDashboard] Failed to search emails:', error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	// Filter and sort emails
	const filteredEmails = useMemo(() => {
		let result = [...emails];

		// Filter by case folder
		if (selectedCaseFolder !== 'all') {
			result = result.filter(e => e.caseFolderPath === selectedCaseFolder || e.caseFolderPath.startsWith(selectedCaseFolder));
		}

		// Sort
		result.sort((a, b) => {
			let comparison = 0;
			switch (sortField) {
				case 'date':
					comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
					break;
				case 'from':
					comparison = a.from.localeCompare(b.from);
					break;
				case 'subject':
					comparison = a.subject.localeCompare(b.subject);
					break;
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});

		return result;
	}, [emails, selectedCaseFolder, sortField, sortDirection]);

	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center h-full p-8"
				style={{ backgroundColor: '#0a0a0a' }}
			>
				<div className="text-center">
					<div
						className="rounded-full h-10 w-10 border-2 mx-auto mb-4 animate-spin"
						style={{
							borderColor: `${BRAND_GREEN} transparent ${BRAND_GREEN} transparent`
						}}
					/>
					<p style={{ color: '#a1a1aa' }}>Loading emails...</p>
				</div>
			</div>
		);
	}

	if (emails.length === 0 && !searchQuery) {
		return (
			<div
				className="flex flex-col items-center justify-center h-full p-8"
				style={{ backgroundColor: '#0a0a0a' }}
			>
				<div className="text-center max-w-md">
					{/* Email Icon */}
					<div
						className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
						style={{
							backgroundColor: `${BRAND_GREEN}15`,
							border: `2px solid ${BRAND_GREEN}30`
						}}
					>
						<svg
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke={BRAND_GREEN}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect x="2" y="4" width="20" height="16" rx="2" />
							<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
						</svg>
					</div>

					<h2 className="text-2xl font-bold mb-3" style={{ color: '#fafafa' }}>
						Email Dashboard
					</h2>
					<p className="mb-8 text-base" style={{ color: '#a1a1aa' }}>
						Import emails from your case files to manage correspondence and draft replies with AI assistance.
					</p>

					<button
						onClick={handleImportEmail}
						className="px-8 py-3 rounded-lg font-semibold text-base transition-all duration-200 hover:scale-105"
						style={{
							backgroundColor: BRAND_GREEN,
							color: '#0a0a0a',
							boxShadow: `0 4px 14px ${BRAND_GREEN}40`
						}}
					>
						<span className="flex items-center gap-2">
							<i className="codicon codicon-add" />
							Import Emails
						</span>
					</button>

					<p className="mt-6 text-sm" style={{ color: '#71717a' }}>
						Supports .eml and .pdf email files
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className="h-full flex flex-col"
			style={{ backgroundColor: '#0a0a0a' }}
		>
			{/* Toolbar */}
			<EmailToolbar
				onImportEmail={handleImportEmail}
				searchQuery={searchQuery}
				onSearchChange={handleSearch}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				sortField={sortField}
				onSortFieldChange={setSortField}
				sortDirection={sortDirection}
				onSortDirectionChange={setSortDirection}
				showFilters={showFilters}
				onToggleFilters={() => setShowFilters(!showFilters)}
				emailCount={filteredEmails.length}
			/>

			{/* Filters Panel (collapsible) */}
			{showFilters && (
				<EmailFilters
					caseFolders={caseFolders}
					selectedCaseFolder={selectedCaseFolder}
					onCaseFolderChange={setSelectedCaseFolder}
				/>
			)}

			{/* Email List */}
			<div className="flex-1 overflow-y-auto p-4">
				{filteredEmails.length === 0 ? (
					<div className="text-center py-12">
						<p style={{ color: '#71717a' }}>
							{searchQuery ? 'No emails match your search.' : 'No emails in this folder.'}
						</p>
					</div>
				) : (
					<div className="space-y-3 max-w-4xl mx-auto">
						{filteredEmails.map((email) => (
							<EmailCard
								key={email.id}
								email={email}
								onClick={() => handleOpenEmail(email)}
								onDelete={() => handleDeleteEmail(email.id)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

