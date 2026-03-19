import React, { useState, useEffect } from 'react';
import { requestJira, router } from '@forge/bridge';
import '@atlaskit/css-reset';


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
  const [selectedProject, setSelectedProject] = useState("PHD");
  const [statusData, setStatusData] = useState([]);
  const [issues, setIssues] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [totalIssues, setTotalIssues] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [slaData, setSlaData] = useState([]);
  //const [totalStatusIssues, setTotalStatusIssues] = useState(0);

  const pageSize = 10;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB").replace(/\//g, "-");
  };
  const maxCount = Math.max(
    ...chartData.map(item => item.count),
    1
  );

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

      let allIssues = [];
      let nextPageToken = null;

      do {

        const body = {
          jql,
          maxResults: 100,
          fields: ["created"]
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!data.issues) break;

        allIssues = [...allIssues, ...data.issues];
        nextPageToken = data.nextPageToken;

      } while (nextPageToken);


      // Group by Date
      const grouped = {};

      allIssues.forEach(issue => {

        const date = new Date(issue.fields.created)
          .toLocaleDateString("en-CA");

        grouped[date] = (grouped[date] || 0) + 1;

      });

      const formatted = Object.keys(grouped)
        .sort()
        .map(date => ({
          date,
          count: grouped[date]
        }));

      setChartData(formatted);

    } catch (error) {
      console.error(error);
    }
  };

  // Fetch list of projects for dropdown
  const fetchProjects = async () => {
    try {
      const response = await requestJira(
        `/rest/api/3/project/search`,
        {
          headers: { Accept: "application/json" }
        }
      );

      const data = await response.json();

      setProjects(data.values);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

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

      console.log("Status JQL:", jql);

      let allIssues = [];
      let nextPageToken = null;

      do {
        const body = {
          jql,
          maxResults: 100,
          fields: ["status"]
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!data.issues) {
          console.error("No issues returned:", data);
          return;
        }

        allIssues = [...allIssues, ...data.issues];
        nextPageToken = data.nextPageToken;

      } while (nextPageToken);

      // Group by status
      const grouped = {};

      allIssues.forEach(issue => {
        const statusName = issue.fields.status.name;
        const category = issue.fields.status.statusCategory.name;

        if (!grouped[statusName]) {
          grouped[statusName] = {
            count: 0,
            category
          };
        }

        grouped[statusName].count += 1;
      });

      const formatted = Object.keys(grouped).map(status => ({
        status,
        count: grouped[status].count,
        category: grouped[status].category
      }));

      formatted.sort((a, b) => b.count - a.count);

      setStatusData(formatted);

    } catch (error) {
      console.error("Error fetching status data:", error);
    }
  };

  // Total Count
  const fetchTotalIssues = async () => {
    try {

      let jql = `created >= "${fromDate}" 
AND created <= "${toDate} 23:59" 
AND statusCategory IN ("To Do","In Progress")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      const response = await requestJira(`/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jql,
          maxResults: 0,
          fields: []
        })
      });

      const data = await response.json();

      console.log("Total Issues Response:", data);

      if (data.total !== undefined) {
        setTotalIssues(data.total);
      }

    } catch (error) {
      console.error("Error fetching total issues:", error);
    }
  };

  // list view
  const fetchOpenIssues = async (token = null) => {

    try {

      let jql = `created >= "${fromDate}" 
AND created <= "${toDate} 23:59" 
AND statusCategory IN ("To Do","In Progress")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      const body = {
        jql,
        maxResults: pageSize,
        fields: ["summary", "status", "assignee", "created"]
      };

      if (token) {
        body.nextPageToken = token;
      }

      const response = await requestJira(`/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      setIssues(prev => [...prev, ...(data.issues || [])]);

      setNextPageToken(data.nextPageToken || null);

      setTotalIssues(data.total || 0);

    } catch (error) {
      console.error("Error fetching issues:", error);
    }

  };

  // SLA Status
  const fetchSLAData = async () => {

    setSlaData([]);

    try {

      let jql = `created >= "${fromDate}"
AND created <= "${toDate} 23:59"
AND statusCategory = Done
AND status NOT IN ("Canceled")`;

      if (selectedProject) {
        jql += ` AND project = "${selectedProject}"`;
      }

      let allIssues = [];
      let nextPageToken = null;

      do {

        const body = {
          jql,
          maxResults: 100,
          fields: ["customfield_10273"]
        };

        if (nextPageToken) {
          body.nextPageToken = nextPageToken;
        }

        const response = await requestJira(`/rest/api/3/search/jql`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!data.issues) break;

        allIssues = [...allIssues, ...data.issues];
        nextPageToken = data.nextPageToken;

      } while (nextPageToken);

      if (allIssues.length === 0) {
        setSlaData([{ label: "No SLA Tracked", count: null }]);
        return;
      }

      const grouped = {
        Met: 0,
        Breached: 0
      };

      let hasSLA = false;

      allIssues.forEach(issue => {

        const slaField = issue.fields?.["customfield_10273"];
        if (!slaField) return;

        hasSLA = true;

        const sla =
          typeof slaField === "string"
            ? slaField
            : slaField.value;

        if (sla === "Met") grouped.Met += 1;
        if (sla === "Breached") grouped.Breached += 1;

      });

      if (!hasSLA) {
        setSlaData([{ label: "No SLA Tracked", count: null }]);
        return;
      }

      setSlaData([
        { label: "Issues Closed within SLA", count: grouped.Met },
        { label: "Issues Closed outside of SLA", count: grouped.Breached }
      ]);

    } catch (error) {
      console.error("Error fetching SLA data:", error);
    }
  };

  const total = statusData.reduce((sum, item) => sum + item.count, 0);
  //const total = totalStatusIssues;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  // JQL for total donut click
  let totalJql = `created >= "${fromDate}" AND created <= "${toDate} 23:59"`;

  if (selectedProject) {
    totalJql += ` AND project = "${selectedProject}"`;
  }

  const encodedTotalJql = encodeURIComponent(totalJql);
  const totalJiraUrl = `/issues/?jql=${encodedTotalJql}`;

  const chartStyle = {
    maxWidth: '600px',
    marginTop: '24px',
  };

  const barContainerStyle = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '24px',
    height: '200px',
    padding: '16px 16px 40px 16px', // Top, right, bottom (extra for labels), left
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f5f5f5',
    boxSizing: 'border-box',
  };

  const barStyle = (value) => {
    const availableHeight = 200 - 32; // Container height minus padding
    const barHeight = (value / maxCount) * availableHeight;
    return {
      width: '60px', // Fixed width for bars
      height: `${barHeight}px`,
      backgroundColor: '#0052CC',
      borderRadius: '4px 4px 0 0',
      minHeight: '20px',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: '8px',
      color: 'white',
      fontWeight: 'bold',
    };
  };

  const buttonStyle = (isSelected) => ({
    padding: '8px 16px',
    marginRight: '8px',
    backgroundColor: isSelected ? '#0052CC' : 'transparent',
    color: isSelected ? 'white' : 'inherit',
    border: '1px solid #0052CC',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '14px',
  });

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

  // Automatically fetch data on initial load
  useEffect(() => {
    if (selectedProject && fromDate && toDate) {
      fetchTotalIssues();
      fetchIssueData();
      fetchStatusData();
      fetchOpenIssues();
      fetchSLAData();
    }
  }, []);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          Select Date Range & Project
        </h1>
        <div style={{ marginBottom: "24px" }}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ marginRight: "12px", padding: "6px" }}
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ marginRight: "12px", padding: "6px" }}
          />

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ marginRight: "12px", padding: "6px" }}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.key}>
                {project.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setIssues([]);
              setNextPageToken(null);
              fetchTotalIssues(); 
              fetchIssueData();   // date chart
              fetchStatusData();  // status donut
              fetchOpenIssues();
              fetchSLAData();
              setTotalIssues(0);
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0052CC",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {chartData.length === 0 && (
        <p style={{ marginTop: "16px" }}>
          No issues found for selected date range.
        </p>
      )}

      <div style={{ display: "flex", gap: "80px", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ marginBottom: "20px" }}>Status of Issues Created</h2>

          {statusData.length === 0 && <p>No data available</p>}

          {statusData.length > 0 && (
            <div style={{ display: "flex", gap: "40px", alignItems: "center" }}>

              {/* Donut Chart */}
              <svg width="200" height="200" viewBox="0 0 200 200">
                <g transform="rotate(-90 100 100)">
                  {[...statusData].reverse().map((item, index) => {
                    const percent = item.count / total;
                    const strokeDasharray = `${percent * circumference} ${circumference}`;
                    const strokeDashoffset = -cumulativePercent * circumference;

                    cumulativePercent += percent;

                    return (
                      <circle
                        key={index}
                        r={radius}
                        cx="100"
                        cy="100"
                        fill="transparent"
                        stroke={getStatusColor(item.status, item.category)}
                        strokeWidth="30"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="butt"
                        style={{
                          cursor: "pointer",
                          pointerEvents: "visibleStroke"
                        }}
                        onClick={() => {
                          let jql = `status = "${item.status}" AND created >= "${fromDate}" AND created <= "${toDate} 23:59"`;

                          if (selectedProject) {
                            jql += ` AND project = "${selectedProject}"`;
                          }

                          router.open(`/issues/?jql=${encodeURIComponent(jql)}`);
                        }}
                      />
                    );
                  })}
                </g>
                <text
                  x="100"
                  y="95"
                  textAnchor="middle"
                  fontSize="28"
                  fontWeight="bold"
                  fill="#0052CC"
                  style={{ cursor: "pointer" }}
                  onClick={() => router.open(totalJiraUrl)}
                >
                  {total}
                </text>

                <text
                  x="100"
                  y="120"
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6B778C"
                >
                  Total Issues
                </text>
              </svg>

              {/* Legend */}
              <div>
                {statusData.map((item, index) => {
                  const colors = [
                    "#0052CC",
                    "#36B37E",
                    "#FFAB00",
                    "#FF5630",
                    "#6554C0",
                    "#00B8D9"
                  ];

                  const percent = ((item.count / total) * 100).toFixed(1);
                  let jql = `status = "${item.status}" AND created >= "${fromDate}" AND created <= "${toDate} 23:59"`;
                  if (selectedProject) {
                    jql += ` AND project = "${selectedProject}"`;
                  }
                  const encodedJql = encodeURIComponent(jql);
                  const jiraUrl = `/issues/?jql=${encodedJql}`;

                  return (
                    <div
                      key={index}
                      onClick={() => router.open(jiraUrl)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "8px",
                        cursor: "pointer"
                      }}
                    >
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          backgroundColor: getStatusColor(item.status, item.category),
                          marginRight: "8px"
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "160px"
                        }}
                      >
                        <span>{item.status}</span>
                        <span style={{ fontWeight: "500" }}>
                          {item.count} ({percent}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            width: "1px",
            backgroundColor: "#DFE1E6",
            margin: "0 40px",
            height: "260px"
          }}
        />

        <div style={{ minWidth: "320px" }}>
          <h2 style={{ marginBottom: "20px" }}>SLA Performance</h2>

          <div
            style={{
              border: "1px solid #DFE1E6",
              borderRadius: "10px",
              padding: "20px",
              backgroundColor: "#F4F5F7",
              width: "260px"
            }}
          >

            {slaData.length === 1 && slaData[0].count === null ? (

              <div
                style={{
                  textAlign: "center",
                  color: "#6B778C",
                  fontWeight: "500",
                  fontSize: "16px"
                }}
              >
                No SLA Tracked
              </div>

            ) : (

              slaData.map((item, index) => {

                let jql = `"SLA Status" = "${item.label.includes("within") ? "Met" : "Breached"}"
AND statusCategory = Done 
AND status NOT IN ("Canceled")`;

                if (fromDate && toDate) {
                  jql += ` AND created >= "${fromDate}" AND created <= "${toDate} 23:59"`;
                }

                if (selectedProject) {
                  jql += ` AND project = "${selectedProject}"`;
                }

                const encodedJql = encodeURIComponent(jql);
                const jiraUrl = `/issues/?jql=${encodedJql}`;

                return (
                  <div
                    key={index}
                    onClick={() => router.open(jiraUrl)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "10px",
                      cursor: "pointer"
                    }}
                  >
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        backgroundColor: item.label.includes("within") ? "#36B37E" : "#EA3680",
                        marginRight: "8px"
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "245px",
                        fontSize: "16px",
                        fontWeight: "500"
                      }}
                    >
                      <span>{item.label}</span>
                      <span>{item.count}</span>
                    </div>
                  </div>
                );

              })

            )}

          </div>
        </div>
      </div>
      {/* Date-wise Chart */}
      <div>
        <h2 style={{ marginBottom: "20px" }}>Issues by Created Date</h2>

        <div style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "12px",
          height: "220px",
          padding: "20px 16px 40px 16px",
          border: "1px solid #ddd",
          borderRadius: "6px",
          background: "#f4f5f7",
          overflowX: "auto"
        }}>
          {chartData.map((item, index) => {
            const chartHeight = 160;
            const barHeight = (item.count / maxCount) * chartHeight

            // Build JQL for that specific date
            const nextDate = new Date(item.date);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDateStr = nextDate.toISOString().split("T")[0];

            let jql = `created >= "${item.date}" AND created < "${nextDateStr}"`;
            if (selectedProject) {
              jql += ` AND project = "${selectedProject}"`;
            }
            const encodedJql = encodeURIComponent(jql);
            const jiraUrl = `/issues/?jql=${encodedJql}`;
            return (
              <div key={index} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: "60px",
                cursor: "pointer"
              }}
                onClick={() => router.open(jiraUrl)}
              >
                <div style={{
                  height: `${Math.max(barHeight, 8)}px`,
                  width: "40px",
                  backgroundColor: "#2E8B57",
                  borderRadius: "4px 4px 0 0",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "9px",
                  paddingBottom: "0px"
                }}>
                  {item.count}
                </div>
                <div style={{ fontSize: "11px", marginTop: "6px" }}>
                  {formatDate(item.date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>



      <div style={{ marginTop: "40px" }}>
        <h2>Open  & In Progress Issues</h2>

        {totalIssues > 0 && (
          <div style={{ marginTop: "10px", marginBottom: "10px", fontWeight: "500" }}>
            Showing {issues.length} of {totalIssues} tickets
          </div>
        )}

        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "10px",
          tableLayout: "fixed"
        }}>
          <thead>
            <tr style={{ background: "#f4f5f7" }}>
              <th style={{ padding: "8px", border: "1px solid #ddd", width: "90px"  }}>Key</th>
              <th style={{ padding: "8px", border: "1px solid #ddd", width: "55%" }}>Summary</th>
              <th style={{ padding: "8px", border: "1px solid #ddd", width: "140px" }}>Status</th>
              <th style={{ padding: "8px", border: "1px solid #ddd", width: "150px" }}>Assignee</th>
              <th style={{ padding: "8px", border: "1px solid #ddd", width: "130px" }}>Created</th>
            </tr>
          </thead>

          <tbody>
            {issues.map(issue => (
              <tr key={issue.id}>
                <td style={{ padding: "8px", border: "1px solid #ddd",whiteSpace: "nowrap" }}>
                  <a
                    href={`/browse/${issue.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      router.open(`/browse/${issue.key}`);
                    }}
                  >
                    {issue.key}
                  </a>
                </td>

                <td style={{ padding: "8px", border: "1px solid #ddd",whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {issue.fields.summary}
                </td>

                <td style={{ padding: "8px", border: "1px solid #ddd" ,whiteSpace: "nowrap"}}>
                  {issue.fields.status.name}
                </td>

                <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                  {issue.fields.assignee?.displayName || "Unassigned"}
                </td>

                <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                  {new Date(issue.fields.created).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          {/* <button
            disabled={startAt === 0}
            onClick={() => fetchOpenIssues(startAt - pageSize)}
          >
            Previous
          </button> */}

          <button
            disabled={!nextPageToken}
            onClick={() => fetchOpenIssues(nextPageToken)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0052CC",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: nextPageToken ? "pointer" : "not-allowed"
            }}
          >
            {nextPageToken ? "Load More" : "No More Issues"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
