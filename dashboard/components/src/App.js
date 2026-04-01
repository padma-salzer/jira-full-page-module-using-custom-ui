import React, { useState, useEffect, useRef } from "react";
import { requestJira, router } from "@forge/bridge";
import "@atlaskit/css-reset";

const App = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  //const formatDateForInput = (date) => date.toISOString().split("T")[0];
  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [fromDate, setFromDate] = useState(formatDateForInput(firstDayOfMonth));
  const [toDate, setToDate] = useState(formatDateForInput(today));
  const [chartData, setChartData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [statusData, setStatusData] = useState([]);
  const [issues, setTickets] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [slaData, setSlaData] = useState([]);
  const [openStatusData, setOpenStatusData] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [projectStatusFilter, setProjectStatusFilter] = useState(["Active"]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [allProjects, setAllProjects] = useState([]);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);
  //const [totalStatusTickets, setTotalStatusTickets] = useState(0);

  const pageSize = 10;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB").replace(/\//g, "-");
  };

  const maxCount = Math.max(...chartData.map((item) => item.count), 1);

  const handleProjectStatusChange = (status) => {
    setProjectStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  // Function to handle status filter click for open issues
  const fetchOpenStatusSummary = async () => {
    try {
      let jql = `statusCategory != Done AND status NOT IN ("Closed","Resolved","Canceled")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      let allTickets = [];
      let nextPageToken = null;

      do {
        const body = {
          jql,
          maxResults: 100,
          fields: ["status"],
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!data.issues) break;

        allTickets = [...allTickets, ...data.issues];
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      // Dynamic grouping
      const grouped = {};

      allTickets.forEach((issue) => {
        const status = issue.fields.status.name;
        const category = issue.fields.status.statusCategory.name;

        if (!grouped[status]) {
          grouped[status] = {
            count: 0,
            category,
          };
        }

        grouped[status].count += 1;
      });

      const formatted = Object.keys(grouped).map((status) => ({
        label: status,
        count: grouped[status].count,
        category: grouped[status].category,
      }));

      formatted.sort((a, b) => b.count - a.count);

      setOpenStatusData(formatted);
    } catch (error) {
      console.error(error);
    }
  };

  // Fetch issues based on date range and selected project
  const fetchIssueData = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both dates");
      return;
    }

    try {
      let jql = `created >= "${fromDate}" AND created <= "${toDate} 23:59"`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      let allTickets = [];
      let nextPageToken = null;

      do {
        const body = {
          jql,
          maxResults: 100,
          fields: ["created"],
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!data.issues) break;

        allTickets = [...allTickets, ...data.issues];
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      // Group by Date
      const grouped = {};

      allTickets.forEach((issue) => {
        const date = new Date(issue.fields.created).toLocaleDateString("en-CA");

        grouped[date] = (grouped[date] || 0) + 1;
      });

      const formatted = Object.keys(grouped)
        .sort()
        .map((date) => ({
          date,
          count: grouped[date],
        }));

      setChartData(formatted);
    } catch (error) {
      console.error(error);
    }
  };

  // Fetch list of projects for dropdown
  useEffect(() => {
    const loadProjects = async () => {
      setIsProjectLoading(true);

      try {
        const response = await requestJira(`/rest/api/3/project/search`, {
          headers: { Accept: "application/json" },
        });

        const data = await response.json();
        const projects = data.values || [];

        setAllProjects(projects);
      } catch (e) {
        console.error(e);
      } finally {
        setIsProjectLoading(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    if (!allProjects.length) return;

    const filtered =
      projectStatusFilter.length === 0
        ? allProjects
        : allProjects.filter((project) => {
            const category = project.projectCategory?.name;
            return category && projectStatusFilter.includes(category);
          });

    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    setProjects(sorted);

    const isValidSelection = sorted.some((p) => p.key === selectedProject);

    if (!isValidSelection) {
      const defaultProject = sorted.find((project) => project.key === "PHD");

      if (defaultProject) {
        setSelectedProject(defaultProject.key);
      } else if (sorted.length > 0) {
        setSelectedProject(sorted[0].key);
      } else {
        setSelectedProject("");
      }
    }
  }, [projectStatusFilter, allProjects]);

  useEffect(() => {
    if (selectedProject && isFirstLoad) {
      fetchTotalTickets();
      fetchIssueData();
      fetchStatusData();
      fetchOpenTickets();
      fetchSLAData();
      fetchOpenStatusSummary();
      setIsFirstLoad(false);
    }
  }, [selectedProject]);

  // Fetch issue counts by status for the selected date range and project
  const fetchStatusData = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both dates");
      return;
    }

    try {
      let jql = `created >= "${fromDate}" AND created <= "${toDate} 23:59"`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      let allTickets = [];
      let nextPageToken = null;

      do {
        const body = {
          jql,
          maxResults: 100,
          fields: ["status"],
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!data.issues) {
          console.error("No issues returned:", data);
          return;
        }

        allTickets = [...allTickets, ...data.issues];
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      // Group by status
      const grouped = {};

      allTickets.forEach((issue) => {
        const statusName = issue.fields.status.name;
        const category = issue.fields.status.statusCategory.name;

        if (!grouped[statusName]) {
          grouped[statusName] = {
            count: 0,
            category,
          };
        }

        grouped[statusName].count += 1;
      });

      const formatted = Object.keys(grouped).map((status) => ({
        status,
        count: grouped[status].count,
        category: grouped[status].category,
      }));

      formatted.sort((a, b) => b.count - a.count);

      setStatusData(formatted);
    } catch (error) {
      console.error("Error fetching status data:", error);
    }
  };

  // Total Count
  const fetchTotalTickets = async () => {
    try {
      let jql = `created >= "${fromDate}" AND created <= "${toDate} 23:59" AND statusCategory IN ("To Do","In Progress")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      const response = await requestJira(`/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql,
          maxResults: 0,
          fields: [],
        }),
      });

      const data = await response.json();

      console.log("Total Tickets Response:", data);

      if (data.total !== undefined) {
        setTotalTickets(data.total);
      }
    } catch (error) {
      console.error("Error fetching total issues:", error);
    }
  };

  // list view
  const fetchOpenTickets = async (token = null) => {
    try {
      let jql = `statusCategory != Done AND status NOT IN ("Closed","Resolved","Canceled")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      jql += ` ORDER BY created ASC`;

      const body = {
        jql,
        maxResults: pageSize,
        fields: ["summary", "status", "assignee", "created"],
      };

      if (token) {
        body.nextPageToken = token;
      }

      const response = await requestJira(`/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      setTickets((prev) => [...prev, ...(data.issues || [])]);

      setNextPageToken(data.nextPageToken || null);

      setTotalTickets(data.total || 0);
    } catch (error) {
      console.error("Error fetching issues:", error);
    }
  };

  // SLA Status
  const fetchSLAData = async () => {
    setSlaData([]);

    try {
      let jql = `created >= "${fromDate}" AND created <= "${toDate} 23:59" AND statusCategory = Done AND status NOT IN ("Canceled")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      let allTickets = [];
      let nextPageToken = null;

      do {
        const body = {
          jql,
          maxResults: 100,
          fields: ["customfield_10273"],
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!data.issues) break;

        allTickets = [...allTickets, ...data.issues];
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      if (allTickets.length === 0) {
        setSlaData([{ label: "No SLA Tracked", count: null }]);
        return;
      }

      const grouped = {
        Met: 0,
        Breached: 0,
      };

      let hasSLA = false;

      allTickets.forEach((issue) => {
        const slaField = issue.fields?.["customfield_10273"];
        if (!slaField) return;

        hasSLA = true;

        const sla = typeof slaField === "string" ? slaField : slaField.value;

        if (sla === "Met") grouped.Met += 1;
        if (sla === "Breached") grouped.Breached += 1;
      });

      if (!hasSLA) {
        setSlaData([{ label: "No SLA Tracked", count: null }]);
        return;
      }

      setSlaData([
        { label: "Tickets Closed within SLA", count: grouped.Met },
        { label: "Tickets Closed outside of SLA", count: grouped.Breached },
      ]);
    } catch (error) {
      console.error("Error fetching SLA data:", error);
    }
  };

  const total = statusData.reduce((sum, item) => sum + item.count, 0);
  //const total = totalStatusTickets;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  // JQL for total donut click
  let totalJql = `created >= "${fromDate}" AND created <= "${toDate} 23:59"`;

  if (selectedProject) {
    totalJql += ` AND project = "${selectedProject}"`;
  }

  const encodedTotalJql = encodeURIComponent(totalJql);
  const totalJiraUrl = `/issues/?jql=${encodedTotalJql}`;

  const chartStyle = {
    maxWidth: "600px",
    marginTop: "24px",
  };

  const barContainerStyle = {
    display: "flex",
    alignItems: "flex-end",
    gap: "24px",
    height: "200px",
    padding: "16px 16px 40px 16px", // Top, right, bottom (extra for labels), left
    border: "1px solid #ddd",
    borderRadius: "4px",
    backgroundColor: "#f5f5f5",
    boxSizing: "border-box",
  };

  const barStyle = (value) => {
    const availableHeight = 200 - 32; // Container height minus padding
    const barHeight = (value / maxCount) * availableHeight;
    return {
      width: "60px", // Fixed width for bars
      height: `${barHeight}px`,
      backgroundColor: "#0052CC",
      borderRadius: "4px 4px 0 0",
      minHeight: "20px",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      paddingBottom: "8px",
      color: "white",
      fontWeight: "bold",
    };
  };

  const buttonStyle = (isSelected) => ({
    padding: "8px 16px",
    marginRight: "8px",
    backgroundColor: isSelected ? "#0052CC" : "transparent",
    color: isSelected ? "white" : "inherit",
    border: "1px solid #0052CC",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "15px",
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Function to determine status color based on name and category
  const getStatusColor = (status, category) => {
    const name = status.toLowerCase();

    if (name.includes("cancel")) {
      return "#8B4513"; // brown
    }

    if (name.includes("closed")) {
      return "#008000"; // green
    }

    if (name.includes("resolved")) {
      return "#90EE90"; // light green
    }

    if (name.includes("done")) {
      return "#90EE90"; // light green
    }

    if (category === "In Progress") {
      return "#FF8C00"; // orange
    }

    if (name.includes("in review")) {
      return "#B5E61D"; // green-yellowcd
    }

    if (category === "To Do") {
      return "#0052CC"; // blue
    }

    return "#A5ADBA"; // fallback grey
  };

  const container = {
    padding: "0",
    maxWidth: "100%",
    margin: "10px",
    background: "transparent",
  };

  const card = {
    background: "#FFFFFF",
    borderRadius: "8px",
    padding: "16px",
    border: "1px solid #DFE1E6",
    boxShadow: "0 1px 2px rgba(9, 30, 66, 0.15)",
  };

  const sectionTitle = {
    fontSize: "21px",
    fontWeight: "600",
    marginBottom: "16px",
  };

  const subText = {
    color: "#6B778C",
    fontSize: "13px",
    marginBottom: "12px",
  };

  const divider = {
    width: "1px",
    backgroundColor: "#DFE1E6",
    margin: "0 24px",
  };

  const thStyle = {
    padding: "10px",
    textAlign: "left",
    borderBottom: "2px solid #DFE1E6",
    borderRight: "1px solid #DFE1E6",
    fontSize: "14px",
    fontWeight: "600",
    color: "#172B4D",
  };

  const tdStyle = {
    padding: "10px",
    fontSize: "14px",
    borderBottom: "1px solid #DFE1E6",
    borderRight: "1px solid #DFE1E6",
  };

  return (
    <div
      style={{
        padding: "16px 20px",
        minHeight: "100vh",
        boxSizing: "border-box",
        fontSize: "15px",
      }}
    >
      {/* FILTER BAR */}
      <div
        style={{
          marginBottom: "24px",
          padding: "12px 0",
        }}
      >
        <h2 style={sectionTitle}>Filters</h2>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "16px",
              fontFamily: "inherit",
            }}
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "16px",
              fontFamily: "inherit",
            }}
          />

          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowStatusDropdown((prev) => !prev)}
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                background: "#fff",
                cursor: "pointer",
                minWidth: "160px",
                textAlign: "left",
                fontSize: "16px",
              }}
            >
              Project Status
              {projectStatusFilter.length > 0 && (
                <span
                  style={{
                    marginLeft: "8px",
                    background: "#0052CC",
                    color: "#fff",
                    borderRadius: "12px",
                    padding: "2px 6px",
                    fontSize: "12px",
                  }}
                >
                  +{projectStatusFilter.length}
                </span>
              )}
            </button>

            {showStatusDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "40px",
                  left: 0,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  padding: "8px",
                  zIndex: 10,
                  width: "180px",
                }}
              >
                {["Active", "Inactive", "Completed"].map((status) => (
                  <label
                    key={status}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 0",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.includes(status)}
                      onChange={() => handleProjectStatusChange(status)}
                    />
                    {status}
                  </label>
                ))}
              </div>
            )}
          </div>

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          >
            {projects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.key}>
                  {project.name}
                </option>
              ))
            )}
          </select>

          <button
            onClick={() => {
              if (!selectedProject) {
                setError("No projects available for selected status");
                return;
              }

              setError("");
              setTickets([]);
              setNextPageToken(null);
              fetchTotalTickets();
              fetchIssueData();
              fetchStatusData();
              fetchOpenTickets();
              fetchSLAData();
              setTotalTickets(0);
              fetchOpenStatusSummary();
            }}
            style={{
              padding: "8px 18px",
              backgroundColor: "#0052CC",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "16px",
            }}
          >
            Apply
          </button>
        </div>
        {error && <div style={{ color: "red", marginTop: "8px" }}>{error}</div>}
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
        {/* STATUS CREATED */}
        <div style={{ ...card, flex: 1 }}>
          <h2 style={sectionTitle}>Status of Tickets Created</h2>

          {statusData.length === 0 && <p>No data available</p>}

          {statusData.length > 0 && (
            <div style={{ display: "flex", gap: "22px", alignItems: "center" }}>
              {/* Donut */}
              <svg width="200" height="200" viewBox="0 0 200 200">
                <g transform="rotate(-90 100 100)">
                  {(() => {
                    let cumulative = 0;

                    return statusData.map((item, index) => {
                      const percent = total ? item.count / total : 0;
                      const dash = `${percent * circumference} ${circumference}`;
                      const offset = -cumulative * circumference;

                      cumulative += percent;

                      return (
                        <circle
                          key={item.status}
                          r={radius}
                          cx="100"
                          cy="100"
                          fill="transparent"
                          stroke={getStatusColor(item.status, item.category)}
                          strokeWidth="28"
                          strokeDasharray={dash}
                          strokeDashoffset={offset}
                          pointerEvents="stroke"
                          style={{ cursor: "pointer", pointerEvents: "stroke" }}
                          onClick={() => {
                            let jql = `status = "${item.status}" AND created >= "${fromDate}" AND created <= "${toDate} 23:59"`;

                            if (selectedProject) {
                              jql += ` AND project = "${selectedProject}"`;
                            }

                            router.open(
                              `/issues/?jql=${encodeURIComponent(jql)}`,
                            );
                          }}
                        />
                      );
                    });
                  })()}
                </g>

                <text
                  x="100"
                  y="95"
                  textAnchor="middle"
                  fontSize="26"
                  fontWeight="600"
                  style={{ cursor: "pointer" }}
                  onClick={() => router.open(totalJiraUrl)}
                >
                  {total}
                </text>
                <text
                  x="100"
                  y="120"
                  textAnchor="middle"
                  fontSize="14"
                  fill="#6B778C"
                >
                  Total Tickets
                </text>
              </svg>

              {/* Legend */}
              <div>
                {statusData.map((item, index) => {
                  const percent = ((item.count / total) * 100).toFixed(1);

                  let jql = `status = "${item.status}" AND created >= "${fromDate}" AND created <= "${toDate} 23:59"`;
                  if (selectedProject) {
                    jql += ` AND project = "${selectedProject}"`;
                  }

                  return (
                    <div
                      key={item.label || item.status}
                      onClick={() =>
                        router.open(`/issues/?jql=${encodeURIComponent(jql)}`)
                      }
                      style={{
                        display: "grid",
                        gridTemplateColumns: "16px auto 40px 60px",
                        alignItems: "center",
                        marginBottom: "6px",
                        cursor: "pointer",
                        fontSize: "16px",
                        columnGap: "6px",
                      }}
                    >
                      {/* color box */}
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          backgroundColor: getStatusColor(
                            item.label || item.status,
                            item.category,
                          ),
                        }}
                      />

                      {/* status */}
                      <span>{item.label || item.status}</span>

                      {/* count */}
                      <strong style={{ textAlign: "center" }}>
                        {item.count}
                      </strong>

                      {/* percentage */}
                      <strong style={{ textAlign: "center" }}>
                        ({percent}%)
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ACTIVE */}
        <div style={{ ...card, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ ...sectionTitle, marginBottom: "0" }}>
              All Active Tickets by Status
            </h2>

            <span
              style={{
                color: "#6B778C",
                fontSize: "13px",
              }}
            >
              (Tickets irrespective of date range)
            </span>
          </div>

          {openStatusData.length === 0 && <p>No active tickets available</p>}

          {openStatusData.length > 0 && (
            <div style={{ display: "flex", gap: "22px", alignItems: "center" }}>
              {/* Donut */}
              <svg width="200" height="200" viewBox="0 0 200 200">
                <g transform="rotate(-90 100 100)">
                  {(() => {
                    const total = openStatusData.reduce(
                      (s, i) => s + i.count,
                      0,
                    );
                    let cumulative = 0;

                    return openStatusData.map((item) => {
                      const percent = total ? item.count / total : 0;
                      const dash = `${percent * circumference} ${circumference}`;
                      const offset = -cumulative * circumference;

                      cumulative += percent;

                      return (
                        <circle
                          key={item.label}
                          r={radius}
                          cx="100"
                          cy="100"
                          fill="transparent"
                          stroke={getStatusColor(item.label, item.category)}
                          strokeWidth="28"
                          strokeDasharray={dash}
                          strokeDashoffset={offset}
                          pointerEvents="stroke"
                          style={{ cursor: "pointer", pointerEvents: "stroke" }}
                          onClick={() => {
                            let jql = `status = "${item.label}"`;

                            if (selectedProject) {
                              jql += ` AND project = "${selectedProject}"`;
                            }

                            router.open(
                              `/issues/?jql=${encodeURIComponent(jql)}`,
                            );
                          }}
                        />
                      );
                    });
                  })()}
                </g>

                {/* TOTAL */}
                <text
                  x="100"
                  y="95"
                  textAnchor="middle"
                  fontSize="26"
                  fontWeight="600"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    let jql = `statusCategory != Done AND status NOT IN ("Closed","Resolved","Canceled")`;

                    if (selectedProject) {
                      jql += ` AND project = "${selectedProject}"`;
                    }

                    router.open(`/issues/?jql=${encodeURIComponent(jql)}`);
                  }}
                >
                  {openStatusData.reduce((s, i) => s + i.count, 0)}
                </text>

                <text
                  x="100"
                  y="120"
                  textAnchor="middle"
                  fontSize="14"
                  fill="#6B778C"
                >
                  Total Active Tickets
                </text>
              </svg>

              {/* Legend */}
              <div>
                {(() => {
                  const total = openStatusData.reduce((s, i) => s + i.count, 0);

                  return openStatusData.map((item) => {
                    const percent = total
                      ? ((item.count / total) * 100).toFixed(1)
                      : 0;

                    let jql = `status = "${item.label}"`;

                    if (selectedProject) {
                      jql += ` AND project = "${selectedProject}"`;
                    }

                    return (
                      <div
                        key={item.label}
                        onClick={() =>
                          router.open(`/issues/?jql=${encodeURIComponent(jql)}`)
                        }
                        style={{
                          display: "grid",
                          gridTemplateColumns: "16px auto 40px 60px",
                          alignItems: "center",
                          marginBottom: "6px",
                          cursor: "pointer",
                          fontSize: "16px",
                          columnGap: "6px",
                        }}
                      >
                        {/* color */}
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            backgroundColor: getStatusColor(
                              item.label,
                              item.category,
                            ),
                          }}
                        />

                        {/* label */}
                        <span>{item.label}</span>

                        {/* count */}
                        <strong style={{ textAlign: "center" }}>
                          {item.count}
                        </strong>

                        {/* percentage */}
                        <strong style={{ textAlign: "center" }}>
                          ({percent}%)
                        </strong>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SLA */}
      <div style={{ ...card, marginBottom: "24px" }}>
        {/* Title */}
        <h2 style={sectionTitle}>SLA Performance</h2>

        {slaData.length > 0 && slaData[0].count !== null && (
          <div
            style={{
              display: "flex",
              marginTop: "16px",
              gap: "20px",
            }}
          >
            {/* WITHIN SLA */}
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                cursor: "pointer",
              }}
              onClick={() => {
                let jql = `created >= "${fromDate}" AND created <= "${toDate} 23:59" AND statusCategory = Done AND status NOT IN ("Canceled")
                    AND cf[10273] = "Met"`;

                if (selectedProject) {
                  jql += ` AND project = "${selectedProject}"`;
                }

                router.open(`/issues/?jql=${encodeURIComponent(jql)}`);
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "30px",
                }}
              >
                <span
                  style={{
                    fontWeight: "600",
                    fontSize: "19px",
                    color: "#172B4D",
                  }}
                >
                  Tickets Closed within SLA
                </span>

                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: "700",
                    color: "#36B37E",
                    lineHeight: "1",
                  }}
                >
                  {slaData[0].count}
                </span>
              </div>
            </div>

            {/* OUTSIDE SLA */}
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                cursor: "pointer",
              }}
              onClick={() => {
                let jql = `created >= "${fromDate}" AND created <= "${toDate} 23:59" AND statusCategory = Done AND status NOT IN ("Canceled")
                    AND cf[10273] = "Breached"`;

                if (selectedProject) {
                  jql += ` AND project = "${selectedProject}"`;
                }

                router.open(`/issues/?jql=${encodeURIComponent(jql)}`);
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "30px",
                }}
              >
                <span
                  style={{
                    fontWeight: "600",
                    fontSize: "19px",
                    color: "#172B4D",
                  }}
                >
                  Tickets Closed outside of SLA
                </span>

                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: "700",
                    color: "#FF5630",
                    lineHeight: "1",
                  }}
                >
                  {slaData[1]?.count || 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {slaData.length > 0 && slaData[0].count === null && (
          <div style={{ textAlign: "center", marginTop: "12px" }}>
            No SLA Tracked
          </div>
        )}
      </div>

      {/* BAR CHART */}
      <div style={{ ...card, marginBottom: "24px" }}>
        <h2 style={sectionTitle}>Tickets by Created Date</h2>

        {chartData.length === 0 && <p>No data available</p>}

        {chartData.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "20px",
              height: "220px",
              padding: "20px 16px 32px 16px",
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarGutter: "stable",
            }}
          >
            {chartData.map((item) => {
              const barHeight =
                (Math.sqrt(item.count) / Math.sqrt(maxCount)) * 160;
              let jql = `created >= "${item.date}" AND created <= "${item.date} 23:59"`;

              if (selectedProject) {
                jql += ` AND project = "${selectedProject}"`;
              }

              return (
                <div
                  key={item.date}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: "60px",
                    flex: "0 0 auto",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    router.open(`/issues/?jql=${encodeURIComponent(jql)}`)
                  }
                >
                  {/* BAR */}
                  <div
                    style={{
                      height: `${barHeight}px`,
                      minHeight: "6px",
                      width: "36px",
                      background: "#36B37E",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: "600",
                      paddingBottom: "4px",
                      boxSizing: "border-box",
                    }}
                  >
                    {item.count}
                  </div>
                  {/* DATE */}
                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "6px",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(item.date)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TABLE */}
      <div style={{ ...card,  display: "flex", flexWrap: "wrap", marginBottom: "24px" }}>
        <h2 style={{ ...sectionTitle }}>Open & In Progress Tickets</h2>
        <span
          style={{
            color: "#6B778C",
            fontSize: "18px",
            paddingLeft: "4px",
          }}
        >
          (Tickets irrespective of date range)
        </span>

        {issues.length === 0 && <p>No tickets available</p>}

        {issues.length > 0 && (
          <>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #DFE1E6",
              }}
            >
              <thead>
                <tr style={{ background: "#F4F5F7" }}>
                  <th style={thStyle}>Key</th>
                  <th style={thStyle}>Summary</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Assignee</th>
                  <th style={{ ...thStyle, borderRight: "none" }}>Created</th>
                </tr>
              </thead>

              <tbody>
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    style={{
                      borderBottom: "1px solid #DFE1E6",
                    }}
                  >
                    <td style={tdStyle}>
                      <span
                        style={{
                          color: "#0052CC",
                          cursor: "pointer",
                          fontWeight: "500",
                        }}
                        onClick={() => router.open(`/browse/${issue.key}`)}
                      >
                        {issue.key}
                      </span>
                    </td>

                    <td style={tdStyle}>{issue.fields.summary}</td>
                    <td style={tdStyle}>{issue.fields.status.name}</td>
                    <td style={tdStyle}>
                      {issue.fields.assignee?.displayName || "Unassigned"}
                    </td>
                    <td style={{ ...tdStyle, borderRight: "none" }}>
                      {new Date(issue.fields.created).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {nextPageToken && (
              <button
                onClick={() => fetchOpenTickets(nextPageToken)}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  background: "#0052CC",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Load More
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
