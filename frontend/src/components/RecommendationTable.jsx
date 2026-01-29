import {
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from "@mui/material";

export default function RecommendationsTable() {
  const rows = [
    {
      action: "Charge",
      time: "10:00 – 13:00",
      energy: "12 MWh",
      reason: "Low market price",
      icon: "⬆️",
    },
    {
      action: "Discharge",
      time: "18:00 – 20:00",
      energy: "15 MWh",
      reason: "Peak demand",
      icon: "⬇️",
    },
    {
      action: "Reserve",
      time: "All day",
      energy: "20%",
      reason: "Ancillary services",
      icon: "⏸️",
    },
  ];

  const getActionColor = (action) => {
    switch (action) {
      case "Charge":
        return { background: '#d1fae5', color: '#047857' };
      case "Discharge":
        return { background: '#fecaca', color: '#991b1b' };
      case "Reserve":
        return { background: 'rgba(102, 126, 234, 0.1)', color: '#667eea' };
      default:
        return { background: '#f3f4f6', color: '#374151' };
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 30px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '20px' }}>✅</span>
        <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
          System Recommendations
        </Typography>
      </div>

      {/* Table */}
      <div style={{ padding: '30px', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 500 }}>
          <TableHead>
            <TableRow sx={{ borderBottom: '2px solid #e5e7eb' }}>
              <TableCell sx={{ fontWeight: 700, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>
                Action
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>
                Time
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>
                Energy
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>
                Reason
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, i) => (
              <TableRow 
                key={i}
                sx={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' },
                  transition: 'all 0.2s ease'
                }}
              >
                <TableCell>
                  <Chip
                    icon={<span>{row.icon}</span>}
                    label={row.action}
                    size="small"
                    sx={{
                      ...getActionColor(row.action),
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#374151', fontWeight: 500 }}>
                  {row.time}
                </TableCell>
                <TableCell sx={{ color: '#374151', fontWeight: 500 }}>
                  {row.energy}
                </TableCell>
                <TableCell sx={{ color: '#6b7280' }}>
                  {row.reason}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}