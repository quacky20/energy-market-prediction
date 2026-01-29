import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { Card, CardContent, Typography, Box } from "@mui/material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

export default function BatteryTimeline() {
  const labels = ["10:00", "12:00", "14:00", "16:00", "18:00"];

  const data = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Battery Power (MW)",
        data: [10, 8, -6, -10, -4],
        backgroundColor: ['#10b981', '#10b981', '#ef4444', '#ef4444', '#ef4444'],
        yAxisID: "y",
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        type: "line",
        label: "Market Price ($)",
        data: [25, 30, 45, 60, 55],
        yAxisID: "y1",
        stroke: '#667eea',
        borderColor: '#667eea',
        borderWidth: 3,
        fill: false,
        pointRadius: 6,
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.4,
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
      },
    },
    scales: {
      y: {
        title: { display: true, text: "Battery Power (MW)", font: { size: 12, weight: 600 } },
        grid: { color: '#f0f0f0' },
      },
      y1: {
        position: "right",
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Price ($)", font: { size: 12, weight: 600 } },
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
        <span style={{ fontSize: '20px' }}>📈</span>
        <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
          Battery Operation vs Market Price
        </Typography>
      </div>

      {/* Chart */}
      <div style={{ padding: '30px' }}>
        <Chart type="bar" data={data} options={options} height={300} />
      </div>
    </div>
  );
}