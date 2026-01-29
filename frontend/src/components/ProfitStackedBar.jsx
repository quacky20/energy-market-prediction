import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Typography } from "@mui/material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

export default function ProfitStackedBar() {
  const labels = ["Jan 5", "Jan 10", "Jan 15", "Jan 20", "Jan 25"];

  const data = {
    labels,
    datasets: [
      {
        label: "Energy Arbitrage",
        data: [2000, 1800, 2500, 2200, 2100],
        backgroundColor: '#10b981',
        stack: "profit",
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: "Ancillary Services",
        data: [9000, 8500, 11000, 9800, 10200],
        backgroundColor: '#667eea',
        stack: "profit",
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { 
        position: "bottom",
        labels: {
          padding: 15,
          font: { size: 12 },
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        borderRadius: 8,
        callbacks: {
          label: (ctx) => `$${ctx.raw.toLocaleString()}`,
        }
      },
    },
    scales: {
      x: { 
        stacked: true,
        grid: { display: false },
      },
      y: { 
        stacked: true,
        grid: { color: '#f0f0f0' },
        ticks: {
          callback: (value) => `$${(value / 1000).toFixed(0)}k`,
        }
      },
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
        <span style={{ fontSize: '20px' }}>💰</span>
        <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
          Daily Profit Composition
        </Typography>
      </div>

      {/* Chart */}
      <div style={{ padding: '30px' }}>
        <Bar data={data} options={options} height={300} />
      </div>
    </div>
  );
}