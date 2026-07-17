/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CaseTimeline,
  EventCategory,
  TimelineEvent } from
"../../../../common/timeline/timelineTypes.js";
import { useAccessor } from "../util/services.js";
import { CalendarView } from "./CalendarView.js";
import { CaseSummary } from "./CaseSummary.js";
import { DeadlineWarnings } from "./DeadlineWarnings.js";
import { EventEditor } from "./EventEditor.js";
import { JurisdictionSelector } from "./JurisdictionSelector.js";
import { NotificationPreferences } from "./NotificationPreferences.js";
import { TimelineEventCard } from "./TimelineEventCard.js";
import { TimelineToolbar } from "./TimelineToolbar.js";
import { TodayMarker } from "./TodayMarker.js";

// Zoom/view mode types
export type TimelineViewMode = "all" | "year" | "month" | "week";

// Display mode: timeline list vs calendar grid
export type DisplayMode = "timeline" | "calendar";

// Reusable style objects with VSCode CSS variables
const containerStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-editor-background)",
  color: "var(--vscode-editor-foreground)"
};

const sidebarStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-sideBar-background)"
};

const buttonPrimaryStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-button-background)",
  color: "var(--vscode-button-foreground)",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const descriptionStyle: React.CSSProperties = {
  color: "var(--vscode-descriptionForeground)"
};

export const TimelineDashboard: React.FC = () => {
  const accessor = useAccessor();
  const timelineService = accessor.get("ITimelineService");

  const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [filterCategory, setFilterCategory] = useState<EventCategory | "all">(
    "all"
  );
  const [showDeadlinesOnly, setShowDeadlinesOnly] = useState(false);
  const [isFirstEventCreation, setIsFirstEventCreation] = useState(false);
  const [showJurisdictionSelector, setShowJurisdictionSelector] =
  useState(false);
  const [viewMode, setViewMode] = useState<TimelineViewMode>("all");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("timeline");
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
  const [showNotificationSettings, setShowNotificationSettings] =
  useState(false);

  // Google Calendar integration state
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Outlook Calendar integration state (disabled until Azure is enabled)
  const [outlookCalendarConnected, setOutlookCalendarConnected] =
  useState(false);
  const [isOutlookSyncing, setIsOutlookSyncing] = useState(false);

  // Load timeline on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const loaded = await timelineService.loadTimeline();
        setTimeline(loaded);

        // Check if Google/Outlook Calendar is already connected
        const syncStateService = accessor.get("ICalendarSyncStateService");
        if (syncStateService) {
          const syncState = await syncStateService.loadSyncState();
          if (syncState?.connected && syncState?.provider === "google") {
            setGoogleCalendarConnected(true);

            // Re-set credentials if we have tokens
            if (syncState.tokens) {
              const googleCalendarService = accessor.get(
                "IGoogleCalendarClientService"
              );
              if (googleCalendarService) {
                await googleCalendarService.setCredentials({
                  accessToken: syncState.tokens.accessToken,
                  refreshToken: syncState.tokens.refreshToken,
                  expiresAt: syncState.tokens.expiresAt
                });
              }
            }
          } else if (
          syncState?.connected &&
          syncState?.provider === "outlook")
          {
            setOutlookCalendarConnected(true);

            // Re-set credentials if we have tokens
            if (syncState.tokens) {
              const outlookCalendarService = accessor.get(
                "IOutlookCalendarClientService"
              );
              if (outlookCalendarService) {
                await outlookCalendarService.setCredentials({
                  accessToken: syncState.tokens.accessToken,
                  refreshToken: syncState.tokens.refreshToken,
                  expiresAt: syncState.tokens.expiresAt
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("[TimelineDashboard] Failed to load timeline:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();

    // Subscribe to timeline changes
    const disposable = timelineService.onDidChangeTimeline((newTimeline) => {
      setTimeline(newTimeline);
    });

    // Subscribe to Void Cloud Google Calendar tokens (auto-connect when signing in)
    const voidCloudService = accessor.get("IVoidCloudService");
    let cloudDisposable: {dispose: () => void;} | null = null;
    if (voidCloudService && voidCloudService.onGoogleCalendarTokensAvailable) {
      cloudDisposable = voidCloudService.onGoogleCalendarTokensAvailable(
        async (tokens: {accessToken: string;refreshToken: string;}) => {
          console.log(
            "[TimelineDashboard] Received Google Calendar tokens from Void Cloud"
          );
          try {
            const googleCalendarService = accessor.get(
              "IGoogleCalendarClientService"
            );
            const syncStateService = accessor.get("ICalendarSyncStateService");

            if (googleCalendarService && syncStateService) {
              // Calculate expiry (Google tokens typically last 1 hour)
              const expiresAt = new Date(
                Date.now() + 3600 * 1000
              ).toISOString();

              // Set credentials
              await googleCalendarService.setCredentials({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt
              });

              // Save to sync state
              await syncStateService.setProvider("google", {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt
              });

              setGoogleCalendarConnected(true);
              console.log(
                "[TimelineDashboard] Google Calendar auto-connected via Void Cloud"
              );
            }
          } catch (error) {
            console.error(
              "[TimelineDashboard] Failed to auto-connect Google Calendar:",
              error
            );
          }
        }
      );
    }

    return () => {
      disposable.dispose();
      cloudDisposable?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineService]); // accessor is stable (module-level), don't include to prevent re-render loops

  const handleAddEvent = useCallback(() => {
    setEditingEvent(null);
    setIsFirstEventCreation(false);
    setPrefilledDate(null);
    setShowEventEditor(true);
  }, []);

  const handleAddEventWithDate = useCallback((date: Date) => {
    setEditingEvent(null);
    setIsFirstEventCreation(false);
    setPrefilledDate(date.toISOString().split("T")[0]);
    setShowEventEditor(true);
  }, []);

  const handleEditEvent = useCallback((event: TimelineEvent) => {
    setEditingEvent(event);
    setIsFirstEventCreation(false);
    setShowEventEditor(true);
  }, []);

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      try {
        await timelineService.deleteEvent(eventId);
      } catch (error) {
        console.error("[TimelineDashboard] Failed to delete event:", error);
      }
    },
    [timelineService]
  );

  const handleSaveEvent = useCallback(
    async (
    eventData: Omit<TimelineEvent, "id" | "createdAt" | "updatedAt">) =>
    {
      try {
        if (editingEvent) {
          await timelineService.updateEvent(editingEvent.id, eventData);
        } else {
          await timelineService.addEvent(eventData);
        }
        setShowEventEditor(false);
        setEditingEvent(null);
        setIsFirstEventCreation(false);
      } catch (error) {
        console.error("[TimelineDashboard] Failed to save event:", error);
      }
    },
    [timelineService, editingEvent]
  );

  const handleCancelEdit = useCallback(() => {
    setShowEventEditor(false);
    setEditingEvent(null);
    setIsFirstEventCreation(false);
  }, []);

  const handleCreateTimeline = useCallback(async () => {
    try {
      // Create timeline pre-populated with case config data
      // This will also auto-create an injury event if injury date is available
      await timelineService.createTimelineWithCaseConfig();
      // Timeline will update via onDidChangeTimeline event
    } catch (error) {
      console.error("[TimelineDashboard] Failed to create timeline:", error);
      // Fallback: open event editor for manual creation
      setEditingEvent(null);
      setIsFirstEventCreation(true);
      setShowEventEditor(true);
    }
  }, [timelineService]);

  const handleSyncFromCase = useCallback(async () => {
    try {
      const synced = await timelineService.syncFromCaseConfig();
      if (!synced) {
        console.log("[TimelineDashboard] No case config to sync from");
      }
    } catch (error) {
      console.error(
        "[TimelineDashboard] Failed to sync from case config:",
        error
      );
    }
  }, [timelineService]);

  const handleJurisdictionChange = useCallback(
    async (jurisdictionId: string) => {
      try {
        await timelineService.setJurisdiction(jurisdictionId);
      } catch (error) {
        console.error(
          "[TimelineDashboard] Failed to change jurisdiction:",
          error
        );
      }
    },
    [timelineService]
  );

  const handleJurisdictionClick = useCallback(() => {
    setShowJurisdictionSelector(true);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const pdfBytes = await timelineService.exportToPDF();

      // Create a Blob and download as PDF
      // Wrap in new Uint8Array to ensure proper type for Blob constructor
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Build filename from available case info
      // Use caseName if available, otherwise extract last meaningful segment from caseId
      const rawId = timeline?.caseName || timeline?.caseId || "";

      // Extract last path segment if it looks like a path (contains any slashes)
      const segments = rawId.split(/[/\\]+/).filter((s) => s && s.length > 1);
      const baseName = segments.length > 0 ? segments[segments.length - 1] : "";

      // Sanitize for filename safety
      const sanitizedName =
      baseName.
      replace(/[\\/:*?"<>|]/g, "_").
      replace(/\s+/g, "_").
      replace(/_+/g, "_").
      replace(/^_|_$/g, "").
      substring(0, 50) || "export";

      const dateStamp = new Date().toISOString().split("T")[0];
      a.download = `Timeline_${sanitizedName}_${dateStamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("[TimelineDashboard] Timeline exported as PDF successfully");
    } catch (error) {
      console.error("[TimelineDashboard] Failed to export timeline:", error);
    }
  }, [timelineService, timeline]);

  // Handle .ics calendar export
  const handleExportIcs = useCallback(async () => {
    try {
      const icsContent = await timelineService.exportToIcs();

      // Create a Blob and download as .ics
      const blob = new Blob([icsContent], {
        type: "text/calendar;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Build filename from case info
      const rawId = timeline?.caseName || timeline?.caseId || "";
      const segments = rawId.split(/[/\\]+/).filter((s) => s && s.length > 1);
      const baseName = segments.length > 0 ? segments[segments.length - 1] : "";
      const sanitizedName =
      baseName.
      replace(/[\\/:*?"<>|]/g, "_").
      replace(/\s+/g, "_").
      replace(/_+/g, "_").
      replace(/^_|_$/g, "").
      substring(0, 50) || "export";

      const dateStamp = new Date().toISOString().split("T")[0];
      a.download = `Timeline_${sanitizedName}_${dateStamp}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("[TimelineDashboard] Timeline exported as .ics successfully");
    } catch (error) {
      console.error("[TimelineDashboard] Failed to export .ics:", error);
    }
  }, [timelineService, timeline]);

  // Handle toggling calendar sync for an event
  const handleToggleSyncToCalendar = useCallback(
    async (eventId: string) => {
      try {
        await timelineService.toggleSyncToCalendar(eventId);
      } catch (error) {
        console.error(
          "[TimelineDashboard] Failed to toggle calendar sync:",
          error
        );
      }
    },
    [timelineService]
  );

  // Get calendar event count for toolbar display
  const calendarEventCount = useMemo(() => {
    return timelineService.getCalendarEventCount();
  }, [timeline, timelineService]);

  // Google Calendar handlers
  const handleConnectGoogleCalendar = useCallback(async () => {
    try {
      // Get the Google Calendar client service via accessor
      const googleCalendarService = accessor.get(
        "IGoogleCalendarClientService"
      );
      if (!googleCalendarService) {
        console.error(
          "[TimelineDashboard] Google Calendar service not available"
        );
        return;
      }

      // Check if configured
      const isConfigured = await googleCalendarService.isConfigured();
      if (!isConfigured) {
        console.error(
          "[TimelineDashboard] Google Calendar not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables."
        );
        return;
      }

      // Start OAuth flow
      const tokens = await googleCalendarService.startAuth();
      console.log("[TimelineDashboard] Google Calendar connected successfully");

      // Save tokens to sync state
      const syncStateService = accessor.get("ICalendarSyncStateService");
      if (syncStateService) {
        await syncStateService.setProvider("google", {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        });
      }

      setGoogleCalendarConnected(true);
    } catch (error) {
      console.error(
        "[TimelineDashboard] Failed to connect Google Calendar:",
        error
      );
    }
  }, [accessor]);

  const handleDisconnectGoogleCalendar = useCallback(async () => {
    try {
      const syncStateService = accessor.get("ICalendarSyncStateService");
      if (syncStateService) {
        await syncStateService.clearSyncState();
      }
      setGoogleCalendarConnected(false);
      console.log("[TimelineDashboard] Google Calendar disconnected");
    } catch (error) {
      console.error(
        "[TimelineDashboard] Failed to disconnect Google Calendar:",
        error
      );
    }
  }, [accessor]);

  const handleSyncToGoogleCalendar = useCallback(async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      console.log("[TimelineDashboard] Starting Google Calendar sync...");

      const googleCalendarService = accessor.get(
        "IGoogleCalendarClientService"
      );
      const syncStateService = accessor.get("ICalendarSyncStateService");

      if (!googleCalendarService || !syncStateService) {
        console.error("[TimelineDashboard] Required services not available");
        return;
      }

      // Get sync state
      const syncState = syncStateService.getSyncState();
      if (!syncState?.tokens) {
        console.error("[TimelineDashboard] No tokens available");
        setGoogleCalendarConnected(false);
        return;
      }

      // Set credentials
      await googleCalendarService.setCredentials({
        accessToken: syncState.tokens.accessToken,
        refreshToken: syncState.tokens.refreshToken,
        expiresAt: syncState.tokens.expiresAt
      });

      // Calculate what needs to sync
      const diff = syncStateService.calculateSyncDiff();
      console.log("[TimelineDashboard] Sync diff:", diff);

      if (
      diff.toCreate.length === 0 &&
      diff.toUpdate.length === 0 &&
      diff.toDelete.length === 0)
      {
        console.log("[TimelineDashboard] Nothing to sync");
        return;
      }

      // Get events to sync
      const eventsToSync = timelineService.getEventsForCalendar();
      const workspaceId = syncState.workspaceId;

      // Build sync payload
      const createEvents = diff.toCreate.
      map((eventId) => {
        const event = eventsToSync.find((e) => e.id === eventId);
        if (!event) {
          console.error(
            `[TimelineDashboard] Event ${eventId} not found in eventsToSync!`
          );
          console.log(
            "[TimelineDashboard] Available events:",
            eventsToSync.map((e) => ({ id: e.id, title: e.title }))
          );
          return null;
        }
        console.log(`[TimelineDashboard] Creating calendar event:`, {
          id: event.id,
          title: event.title,
          date: event.date
        });
        return {
          id: event.id,
          title: event.title,
          description: event.description,
          date: event.date,
          isAllDay: !event.date.includes("T"),
          reminders: event.reminderDays?.map((d) => d * 24 * 60), // Convert days to minutes
          workspaceId
        };
      }).
      filter(Boolean) as {
        id: string;
        title: string;
        description?: string;
        date: string;
        isAllDay: boolean;
        reminders?: number[];
        workspaceId: string;
      }[];

      const updateEvents = diff.toUpdate.map((eventId) => {
        const event = eventsToSync.find((e) => e.id === eventId)!;
        const syncedState = syncState.syncedEvents[eventId];
        return {
          event: {
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            isAllDay: !event.date.includes("T"),
            reminders: event.reminderDays?.map((d) => d * 24 * 60),
            workspaceId
          },
          calendarEventId: syncedState.calendarEventId
        };
      });

      const deleteEventIds = diff.toDelete.
      map((eventId) => {
        return syncState.syncedEvents[eventId]?.calendarEventId;
      }).
      filter(Boolean);

      // Perform sync
      const results = await googleCalendarService.syncEvents(
        {
          create: createEvents,
          update: updateEvents,
          delete: deleteEventIds
        },
        syncState.syncedEvents,
        syncState.settings.calendarId
      );

      // Update sync state with results
      for (const { eventId, calendarEventId } of results.created) {
        await syncStateService.markEventSynced(eventId, calendarEventId);
      }
      for (const { eventId, calendarEventId } of results.updated) {
        await syncStateService.markEventSynced(eventId, calendarEventId);
      }
      for (const calendarEventId of results.deleted) {
        // Find the event ID by calendar event ID
        const entry = Object.entries(syncState.syncedEvents).find(
          ([, state]) => state.calendarEventId === calendarEventId
        );
        if (entry) {
          await syncStateService.markEventDeleted(entry[0]);
        }
      }

      console.log(
        "[TimelineDashboard] Google Calendar sync complete:",
        results
      );
    } catch (error) {
      console.error("[TimelineDashboard] Google Calendar sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [accessor, timelineService, isSyncing]);

  // Outlook Calendar handlers
  const handleConnectOutlookCalendar = useCallback(async () => {
    try {
      const outlookCalendarService = accessor.get(
        "IOutlookCalendarClientService"
      );
      if (!outlookCalendarService) {
        console.error(
          "[TimelineDashboard] Outlook Calendar service not available"
        );
        return;
      }

      // Check if configured
      const isConfigured = await outlookCalendarService.isConfigured();
      if (!isConfigured) {
        console.error(
          "[TimelineDashboard] Outlook Calendar not configured. Set OUTLOOK_CLIENT_ID environment variable."
        );
        return;
      }

      // Start OAuth flow
      const tokens = await outlookCalendarService.startAuth();
      console.log(
        "[TimelineDashboard] Outlook Calendar connected successfully"
      );

      // Save tokens to sync state
      const syncStateService = accessor.get("ICalendarSyncStateService");
      if (syncStateService) {
        await syncStateService.setProvider("outlook", {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        });
      }

      setOutlookCalendarConnected(true);
    } catch (error) {
      console.error(
        "[TimelineDashboard] Failed to connect Outlook Calendar:",
        error
      );
    }
  }, [accessor]);

  const handleDisconnectOutlookCalendar = useCallback(async () => {
    try {
      const outlookCalendarService = accessor.get(
        "IOutlookCalendarClientService"
      );
      if (outlookCalendarService) {
        await outlookCalendarService.disconnect();
      }

      const syncStateService = accessor.get("ICalendarSyncStateService");
      if (syncStateService) {
        await syncStateService.clearSyncState();
      }
      setOutlookCalendarConnected(false);
      console.log("[TimelineDashboard] Outlook Calendar disconnected");
    } catch (error) {
      console.error(
        "[TimelineDashboard] Failed to disconnect Outlook Calendar:",
        error
      );
    }
  }, [accessor]);

  const handleSyncToOutlookCalendar = useCallback(async () => {
    if (isOutlookSyncing) return;

    try {
      setIsOutlookSyncing(true);
      console.log("[TimelineDashboard] Starting Outlook Calendar sync...");

      const outlookCalendarService = accessor.get(
        "IOutlookCalendarClientService"
      );
      const syncStateService = accessor.get("ICalendarSyncStateService");

      if (!outlookCalendarService || !syncStateService) {
        console.error("[TimelineDashboard] Required services not available");
        return;
      }

      // Get sync state
      const syncState = syncStateService.getSyncState();
      if (!syncState?.tokens) {
        console.error("[TimelineDashboard] No tokens available");
        setOutlookCalendarConnected(false);
        return;
      }

      // Set credentials
      await outlookCalendarService.setCredentials({
        accessToken: syncState.tokens.accessToken,
        refreshToken: syncState.tokens.refreshToken,
        expiresAt: syncState.tokens.expiresAt
      });

      // Calculate what needs to sync
      const diff = syncStateService.calculateSyncDiff();
      console.log("[TimelineDashboard] Outlook sync diff:", diff);

      if (
      diff.toCreate.length === 0 &&
      diff.toUpdate.length === 0 &&
      diff.toDelete.length === 0)
      {
        console.log("[TimelineDashboard] Nothing to sync");
        return;
      }

      // Get events to sync
      const eventsToSync = timelineService.getEventsForCalendar();
      const workspaceId = syncState.workspaceId;

      // Build sync payload
      const createEvents = diff.toCreate.
      map((eventId) => {
        const event = eventsToSync.find((e) => e.id === eventId);
        if (!event) {
          console.error(
            `[TimelineDashboard] Event ${eventId} not found in eventsToSync!`
          );
          return null;
        }
        return {
          id: event.id,
          title: event.title,
          description: event.description,
          date: event.date,
          isAllDay: !event.date.includes("T"),
          reminders: event.reminderDays?.map((d) => d * 24 * 60),
          workspaceId
        };
      }).
      filter(Boolean) as {
        id: string;
        title: string;
        description?: string;
        date: string;
        isAllDay: boolean;
        reminders?: number[];
        workspaceId: string;
      }[];

      const updateEvents = diff.toUpdate.map((eventId) => {
        const event = eventsToSync.find((e) => e.id === eventId)!;
        const syncedState = syncState.syncedEvents[eventId];
        return {
          event: {
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            isAllDay: !event.date.includes("T"),
            reminders: event.reminderDays?.map((d) => d * 24 * 60),
            workspaceId
          },
          calendarEventId: syncedState.calendarEventId
        };
      });

      const deleteEventIds = diff.toDelete.
      map((eventId) => {
        return syncState.syncedEvents[eventId]?.calendarEventId;
      }).
      filter(Boolean);

      // Perform sync
      const results = await outlookCalendarService.syncEvents(
        {
          create: createEvents,
          update: updateEvents,
          delete: deleteEventIds
        },
        syncState.settings.calendarId
      );

      // Update sync state with results
      for (const { eventId, calendarEventId } of results.created) {
        await syncStateService.markEventSynced(eventId, calendarEventId);
      }
      for (const { eventId, calendarEventId } of results.updated) {
        await syncStateService.markEventSynced(eventId, calendarEventId);
      }
      for (const calendarEventId of results.deleted) {
        const entry = Object.entries(syncState.syncedEvents).find(
          ([, state]) => state.calendarEventId === calendarEventId
        );
        if (entry) {
          await syncStateService.markEventDeleted(entry[0]);
        }
      }

      console.log(
        "[TimelineDashboard] Outlook Calendar sync complete:",
        results
      );
    } catch (error) {
      console.error("[TimelineDashboard] Outlook Calendar sync failed:", error);
    } finally {
      setIsOutlookSyncing(false);
    }
  }, [accessor, timelineService, isOutlookSyncing]);

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    if (!timeline) return [];

    let events = [...timeline.events];

    // Filter by category
    if (filterCategory !== "all") {
      events = events.filter((e) => e.category === filterCategory);
    }

    // Filter deadlines only
    if (showDeadlinesOnly) {
      events = events.filter((e) => e.isDeadline);
    }

    // Filter by view mode (time range)
    if (viewMode !== "all") {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(now.getFullYear() + 10, 11, 31); // Far future

      switch (viewMode) {
        case "week":
          // Show events from 1 week ago to 1 week ahead
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          // Show events from this month (start of month to end of month)
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case "year":
          // Show events from this year
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(0);
      }

      events = events.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    // Sort by date (ascending)
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return events;
  }, [timeline, filterCategory, showDeadlinesOnly, viewMode]);

  // Calculate today marker position (no accessor dependency - uses filteredEvents which is stable)
  const todayMarkerIndex = useMemo(() => {
    if (filteredEvents.length === 0) return -1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find where today falls in the sorted events
    for (let i = 0; i < filteredEvents.length; i++) {
      const eventDate = new Date(filteredEvents[i].date);
      eventDate.setHours(0, 0, 0, 0);

      if (eventDate > today) {
        return i; // Insert before this event
      }
    }

    // All events are in the past
    return filteredEvents.length;
  }, [filteredEvents]);

  // Check if today is within the timeline range
  const showTodayMarker = useMemo(() => {
    if (filteredEvents.length === 0) return false;

    const today = new Date();
    const firstEventDate = new Date(filteredEvents[0].date);
    const lastEventDate = new Date(
      filteredEvents[filteredEvents.length - 1].date
    );

    // Show marker if today is between first and last event (with some buffer)
    const bufferDays = 30;
    const bufferMs = bufferDays * 24 * 60 * 60 * 1000;

    return (
      today.getTime() >= firstEventDate.getTime() - bufferMs &&
      today.getTime() <= lastEventDate.getTime() + bufferMs);

  }, [filteredEvents]);

  // Get deadline warnings
  const upcomingDeadlines = React.useMemo(() => {
    return timelineService.getUpcomingDeadlines(7);
  }, [timeline, timelineService]);

  const overdueDeadlines = React.useMemo(() => {
    return timelineService.getOverdueDeadlines();
  }, [timeline, timelineService]);

  if (isLoading) {
    return (
      <div
        className="void-flex void-items-center void-justify-center void-h-full void-p-8"
        style={containerStyle}>
        
				<div className="void-text-center">
					<div
            className="void-rounded-full void-h-10 void-w-10 void-border-2 void-mx-auto void-mb-4 void-animate-spin"
            style={{
              borderColor:
              "var(--vscode-button-background) transparent var(--vscode-button-background) transparent"
            }} />
          
					<p style={descriptionStyle}>Loading timeline...</p>
				</div>
			</div>);

  }

  if (!timeline) {
    return (
      <div
        className="void-flex void-flex-col void-items-center void-justify-center void-h-full void-p-8"
        style={containerStyle}>
        
				<div className="void-text-center void-max-w-md">
					{/* SafeAppeals Logo/Icon */}
					<div
            className="void-w-20 void-h-20 void-rounded-2xl void-mx-auto void-mb-6 void-flex void-items-center void-justify-center"
            style={{
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              border: "2px solid var(--vscode-panel-border)"
            }}>
            
						<i
              className="void-codicon void-codicon-calendar"
              style={{
                fontSize: "40px",
                color: "var(--vscode-button-background)"
              }} />
            
					</div>

					<h2
            className="void-text-2xl void-font-bold void-mb-3"
            style={{ color: "var(--vscode-editor-foreground)" }}>
            
						Create Your Case Timeline
					</h2>
					<p className="void-mb-8 void-text-base" style={descriptionStyle}>
						Track important events, deadlines, and documents for your workers'
						compensation case.
					</p>

					<button
            onClick={handleCreateTimeline}
            className="void-px-8 void-py-3 void-rounded-lg void-font-semibold void-text-base void-transition-all void-duration-200 hover:void-scale-105"
            style={buttonPrimaryStyle}>
            
						<span className="void-flex void-items-center void-gap-2">
							<i className="void-codicon void-codicon-add" />
							Add First Event
						</span>
					</button>

					<p
            className="void-mt-6 void-text-sm"
            style={{ color: "var(--vscode-disabledForeground)" }}>
            
						Start by adding your injury date or initial incident
					</p>
				</div>
			</div>);

  }

  return (
    <div className="void-h-full void-flex void-flex-row" style={containerStyle}>
			{/* Left Panel - Summary & Stats */}
			<div
        className="void-flex void-flex-col void-w-[400px] void-min-w-[350px] void-border-r void-overflow-y-auto void-void-scrollbar"
        style={{
          ...sidebarStyle,
          borderColor: "var(--vscode-panel-border)"
        }}>
        
				{/* Case Summary Dashboard */}
				<CaseSummary timeline={timeline} onEditEvent={handleEditEvent} />

				{/* Deadline Warnings */}
				{(overdueDeadlines.length > 0 || upcomingDeadlines.length > 0) &&
        <DeadlineWarnings
          overdueDeadlines={overdueDeadlines}
          upcomingDeadlines={upcomingDeadlines}
          onClickEvent={handleEditEvent} />

        }
			</div>

			{/* Right Panel - Timeline/Calendar Content */}
			<div
        className="void-flex-1 void-flex void-flex-col void-h-full void-overflow-hidden"
        style={containerStyle}>
        
				{/* Toolbar */}
				<TimelineToolbar
          onAddEvent={handleAddEvent}
          onExport={handleExport}
          onExportIcs={handleExportIcs}
          calendarEventCount={calendarEventCount}
          googleCalendarConnected={googleCalendarConnected}
          onConnectGoogleCalendar={handleConnectGoogleCalendar}
          onDisconnectGoogleCalendar={handleDisconnectGoogleCalendar}
          onSyncToGoogleCalendar={handleSyncToGoogleCalendar}
          isSyncing={isSyncing}
          outlookCalendarConnected={outlookCalendarConnected}
          onConnectOutlookCalendar={handleConnectOutlookCalendar}
          onDisconnectOutlookCalendar={handleDisconnectOutlookCalendar}
          onSyncToOutlookCalendar={handleSyncToOutlookCalendar}
          isOutlookSyncing={isOutlookSyncing}
          onSyncFromCase={handleSyncFromCase}
          filterCategory={filterCategory}
          onFilterChange={setFilterCategory}
          showDeadlinesOnly={showDeadlinesOnly}
          onShowDeadlinesChange={setShowDeadlinesOnly}
          jurisdiction={timelineService.getJurisdiction(timeline.jurisdiction)}
          onJurisdictionClick={handleJurisdictionClick}
          eventCount={timeline.events.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          onEditEvent={handleEditEvent}
          onOpenNotificationSettings={() => setShowNotificationSettings(true)} />
        

				{/* Content Area - Timeline or Calendar */}
				{displayMode === "calendar" ?
        <CalendarView
          events={timeline.events}
          onEventClick={handleEditEvent}
          onAddEvent={handleAddEventWithDate} /> :


        <div className="void-flex-1 void-overflow-y-auto void-p-4 void-void-scrollbar">
						{filteredEvents.length === 0 ?
          <div className="void-text-center void-py-12">
								<p style={{ color: "var(--vscode-disabledForeground)" }}>
									{timeline.events.length === 0 ?
              'No events yet. Click "Add Event" to get started.' :
              "No events match the current filter."}
								</p>
							</div> :

          <div className="void-relative void-max-w-4xl void-mx-auto">
								{/* Timeline line - accent */}
								<div
              className="void-absolute void-left-6 void-top-0 void-bottom-0 void-w-0.5"
              style={{
                backgroundColor: "var(--vscode-button-background)",
                opacity: 0.6
              }} />
            

								{/* Events with Today Marker */}
								<div className="void-space-y-4">
									{filteredEvents.map((event, index) =>
              <React.Fragment key={event.id}>
											{/* Insert Today Marker before this event if appropriate */}
											{showTodayMarker && todayMarkerIndex === index &&
                <TodayMarker />
                }
											<TimelineEventCard
                  event={event}
                  onEdit={() => handleEditEvent(event)}
                  onDelete={() => handleDeleteEvent(event.id)}
                  onToggleSyncToCalendar={() =>
                  handleToggleSyncToCalendar(event.id)
                  }
                  isFirst={index === 0}
                  isLast={index === filteredEvents.length - 1} />
                
										</React.Fragment>
              )}
									{/* Insert Today Marker at end if all events are in the past */}
									{showTodayMarker &&
              todayMarkerIndex === filteredEvents.length &&
              <TodayMarker />
              }
								</div>
							</div>
          }
					</div>
        }
			</div>

			{/* Event Editor Modal */}
			{showEventEditor &&
      <EventEditor
        event={editingEvent}
        jurisdictions={timelineService.getJurisdictions()}
        currentJurisdiction={timeline.jurisdiction}
        onSave={handleSaveEvent}
        onCancel={handleCancelEdit}
        isFirstEvent={isFirstEventCreation} />

      }

			{/* Jurisdiction Selector Modal */}
			{showJurisdictionSelector &&
      <JurisdictionSelector
        jurisdictions={timelineService.getJurisdictions()}
        currentJurisdiction={timelineService.getJurisdiction(
          timeline.jurisdiction
        )}
        onSelect={handleJurisdictionChange}
        onClose={() => setShowJurisdictionSelector(false)} />

      }

			{/* Notification Preferences Modal */}
			{showNotificationSettings &&
      <NotificationPreferences
        onClose={() => setShowNotificationSettings(false)} />

      }
		</div>);

};