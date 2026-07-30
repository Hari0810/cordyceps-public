export function createPageButtonRegistry({
  buttons,
  getActivePage,
  getActiveSettingsPanel,
  getActiveRssPanel,
  setActivePage,
  setActiveSettingsPanel,
  setActiveRssPanel,
  booksFeature,
  notesFeature,
  monzo,
  rss
}) {
  function isSettingsSubpageOpen() {
    return getActivePage() === "settings" && getActiveSettingsPanel() !== "root";
  }

  function isRssSubpageOpen() {
    return getActivePage() === "rss" && getActiveRssPanel() !== "root";
  }

  function isBooksReaderOpen() {
    return getActivePage() === "books" && booksFeature.isReaderOpen();
  }

  function handleBackNavigation() {
    if (isSettingsSubpageOpen()) {
      setActiveSettingsPanel("root");
      return true;
    }

    if (isRssSubpageOpen()) {
      setActiveRssPanel("root");
      return true;
    }

    if (isBooksReaderOpen()) {
      booksFeature.showLibrary();
      return true;
    }

    setActivePage("dashboard");
    return true;
  }

  function canStartPageSwipe() {
    return !isSettingsSubpageOpen() && !isRssSubpageOpen();
  }

  function handlePageEntry(nextPage) {
    if (nextPage === "monzo" && monzo.isConfigured() && monzo.isEmpty()) {
      void monzo.refresh({ silent: true });
    }

    if (nextPage === "rss" && rss.shouldRefreshOnOpen() && !rss.isRefreshing()) {
      void rss.refresh({ silent: true });
    }
  }

  const pageActionsByName = {
    settings() {
      if (getActivePage() === "settings") {
        if (getActiveSettingsPanel() !== "root") {
          setActiveSettingsPanel("root");
          return;
        }

        setActivePage("dashboard");
        return;
      }

      setActiveSettingsPanel("root");
      setActivePage("settings");
    },
    dashboard() {
      setActivePage("dashboard");
    },
    books() {
      const nextPage = getActivePage() === "books" ? "dashboard" : "books";
      setActivePage(nextPage);
      if (nextPage === "books") {
        booksFeature.showLibrary();
      }
    },
    tasks() {
      setActivePage("tasks");
    },
    monzo() {
      const nextPage = getActivePage() === "monzo" ? "dashboard" : "monzo";
      setActivePage(nextPage);
      handlePageEntry(nextPage);
    },
    rss() {
      if (getActivePage() === "rss") {
        if (getActiveRssPanel() !== "root") {
          setActiveRssPanel("root");
          return;
        }

        setActivePage("dashboard");
        return;
      }

      setActiveRssPanel("root");
      setActivePage("rss");
      handlePageEntry("rss");
    },
    calendar() {
      setActivePage(getActivePage() === "calendar" ? "dashboard" : "calendar");
    },
    notes() {
      if (getActivePage() === "notes") {
        setActivePage("dashboard");
        return;
      }

      notesFeature.resetView();
      setActivePage("notes");
    },
    projects() {
      setActivePage(getActivePage() === "projects" ? "dashboard" : "projects");
    },
    habits() {
      setActivePage(getActivePage() === "habits" ? "dashboard" : "habits");
    },
    "plan-your-day"() {
      setActivePage(getActivePage() === "plan-your-day" ? "dashboard" : "plan-your-day");
    }
  };

  const pageActions = [
    {
      button: buttons.openSettingsButton,
      run() {
        pageActionsByName.settings();
      }
    },
    {
      button: buttons.openDashboardButton,
      run() {
        pageActionsByName.dashboard();
      }
    },
    {
      button: buttons.openBooksButton,
      run() {
        pageActionsByName.books();
      }
    },
    {
      button: buttons.openTasksButton,
      run() {
        pageActionsByName.tasks();
      }
    },
    {
      button: buttons.openMonzoButton,
      run() {
        pageActionsByName.monzo();
      }
    },
    {
      button: buttons.openRssButton,
      run() {
        pageActionsByName.rss();
      }
    },
    {
      button: buttons.openCalendarButton,
      run() {
        pageActionsByName.calendar();
      }
    },
    {
      button: buttons.openNotesButton,
      run() {
        pageActionsByName.notes();
      }
    },
    {
      button: buttons.openProjectsButton,
      run() {
        pageActionsByName.projects();
      }
    },
    {
      button: buttons.openHabitsButton,
      run() {
        pageActionsByName.habits();
      }
    }
  ];

  function bind() {
    pageActions.forEach(({ button, run }) => {
      if (!button) {
        return;
      }

      button.addEventListener("click", () => {
        run();
      });
    });
  }

  return {
    bind,
    canStartPageSwipe,
    handleBackNavigation,
    handlePageEntry,
    handleNavigationRequest(nextPage) {
      if (typeof nextPage !== "string") {
        return false;
      }

      const handler = pageActionsByName[nextPage];
      if (typeof handler !== "function") {
        return false;
      }

      handler();
      return true;
    }
  };
}
