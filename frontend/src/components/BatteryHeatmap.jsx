import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Typography } from "@mui/material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
);

export default function BatteryHeatmap() {
  const labels = ["0", "4", "8", "12", "16", "20"];
  const values = [-6, -4, 3, 8, -7, -5];

  const data = {
    labels,
    datasets: [
      {
        label: "Battery Action (MW)",
        data: values,
        backgroundColor: values.map(v =>
          v > 0 ? "#10b981" : "#ef4444"
        ),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    indexAxis: "x",
    responsive: true,
    maintainAspectRatio: true,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        borderRadius: 8,
        callbacks: {
          label: (ctx) => {
            const action = ctx.raw > 0 ? '⬆️ Charge' : '⬇️ Discharge';
            return `${action}: ${Math.abs(ctx.raw)} MW`;
          }
        }
      }
    },
    scales: {
      y: { 
        display: true,
        grid: { display: false },
        ticks: {
          callback: (value) => `${value} MW`,
        }
      },
      x: {
        grid: { color: '#f0f0f0' },
      }
    },
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
        <span style={{ fontSize: '20px' }}>🔋</span>
        <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
          Hourly Battery Pattern
        </Typography>
      </div>

      {/* Chart */}
      <div style={{ padding: '30px' }}>
        <Bar data={data} options={options} height={280} />
      </div>
    </div>
  );
}