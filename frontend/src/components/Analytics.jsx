import React, { useState, useEffect } from 'react'
import { Button } from '../../components/ui/button';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import Papa from 'papaparse';

// Import CSV files directly
import batteryCSV from '../assets/results_battery.csv?raw';
import pnlCSV from '../assets/results_pnl_by_product.csv?raw';
import tradesCSV from '../assets/results_trades_and_reserves.csv?raw';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

function Analytics() {
    const [activeChart, setActiveChart] = useState(null);
    const [batteryData, setBatteryData] = useState([]);
    const [pnlData, setPnlData] = useState([]);
    const [tradesData, setTradesData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Parse CSV data
        const parseCSV = (csvText, setter) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    console.log('Parsed data:', results.data);
                    setter(results.data);
                },
                error: (error) => {
                    console.error('Parse error:', error);
                }
            });
        };

        try {
            parseCSV(batteryCSV, setBatteryData);
            parseCSV(pnlCSV, setPnlData);
            parseCSV(tradesCSV, setTradesData);
            setLoading(false);
        } catch (error) {
            console.error('Error loading CSV data:', error);
            setLoading(false);
        }
    }, []);

    const toggleChart = (chartName) => {
        setActiveChart(activeChart === chartName ? null : chartName);
    };

    // Filter trades data for SP15 only
    const sp15Data = tradesData.filter(row => row.product === 'SP15');

    // Energy Price Chart Data
    const energyPriceData = {
        labels: sp15Data.map((row, index) => row.datetime || `Hour ${index}`),
        datasets: [{
            label: 'SP15 Energy Price ($/MWh)',
            data: sp15Data.map(row => row.price || 0),
            borderColor: 'rgb(20, 184, 166)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            fill: true,
            tension: 0.4
        }]
    };

    // State of Charge Chart Data
    const socData = {
        labels: batteryData.map((row, index) => row.datetime || `Hour ${index}`),
        datasets: [{
            label: 'State of Charge (MWh)',
            data: batteryData.map(row => row.soc_end || 0),
            borderColor: 'rgb(6, 182, 212)',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            fill: true,
            tension: 0.4
        }]
    };

    // Group reserves by time_step
    const reservesByTime = {};
    tradesData.forEach(row => {
        const time = row.datetime || row.time_step;
        if (!reservesByTime[time]) {
            reservesByTime[time] = { RegUp: 0, RegDown: 0, Spin: 0, NonSpin: 0 };
        }
        if (row.product === 'RegUp') reservesByTime[time].RegUp = row.commitment_mw || 0;
        if (row.product === 'RegDown') reservesByTime[time].RegDown = row.commitment_mw || 0;
        if (row.product === 'Spin') reservesByTime[time].Spin = row.commitment_mw || 0;
        if (row.product === 'NonSpin') reservesByTime[time].NonSpin = row.commitment_mw || 0;
    });

    const reservesArray = Object.entries(reservesByTime).map(([time, values]) => ({
        time,
        ...values
    }));

    // Reserves Chart Data
    const reservesData = {
        labels: reservesArray.map(row => row.time),
        datasets: [
            {
                label: 'RegUp (MW)',
                data: reservesArray.map(row => row.RegUp),
                backgroundColor: 'rgba(20, 184, 166, 0.8)',
            },
            {
                label: 'RegDown (MW)',
                data: reservesArray.map(row => row.RegDown),
                backgroundColor: 'rgba(6, 182, 212, 0.8)',
            },
            {
                label: 'Spin (MW)',
                data: reservesArray.map(row => row.Spin),
                backgroundColor: 'rgba(13, 148, 136, 0.8)',
            },
            {
                label: 'NonSpin (MW)',
                data: reservesArray.map(row => row.NonSpin),
                backgroundColor: 'rgba(5, 150, 105, 0.8)',
            }
        ]
    };

    // Profit Forecast Chart Data (using PnL data) - FIXED: use 'pnl' instead of 'revenue'
    const profitData = {
        labels: ['SP15', 'RegUp', 'RegDown', 'Spin', 'NonSpin'],
        datasets: [{
            label: 'Revenue by Product ($)',
            data: [
                pnlData.find(row => row.product === 'SP15')?.pnl || 0,
                pnlData.find(row => row.product === 'RegUp')?.pnl || 0,
                pnlData.find(row => row.product === 'RegDown')?.pnl || 0,
                pnlData.find(row => row.product === 'Spin')?.pnl || 0,
                pnlData.find(row => row.product === 'NonSpin')?.pnl || 0,
            ],
            backgroundColor: [
                'rgba(20, 184, 166, 0.8)',
                'rgba(6, 182, 212, 0.8)',
                'rgba(13, 148, 136, 0.8)',
                'rgba(5, 150, 105, 0.8)',
                'rgba(4, 120, 87, 0.8)',
            ],
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    // Calculate PnL totals - FIXED: use 'pnl' instead of 'revenue'
    const pnlTotals = pnlData.reduce((acc, row) => {
        if (row.product) {
            acc[row.product] = row.pnl || 0;
        }
        return acc;
    }, {});

    if (loading) {
        return <div className='text-center py-12'>Loading data...</div>;
    }

    return (
        <div className='max-w-7xl px-8 w-full'>
            <h2 className='text-4xl font-bold mb-12 text-center'>Market Analytics</h2>

            {/* pnls */}
            <div className='mb-12'>
                <h3 className='text-2xl font-semibold mb-6 text-teal-800'>Profit & Loss by Product</h3>
                <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
                    <div className='bg-linear-to-br from-teal-50 to-cyan-50 p-5 rounded-lg border-2 border-teal-200'>
                        <h4 className='text-sm font-semibold text-teal-700 mb-1'>SP15</h4>
                        <p className='text-2xl font-bold text-teal-900'>${pnlTotals.SP15?.toFixed(0) || '0'}</p>
                    </div>
                    <div className='bg-linear-to-br from-teal-50 to-cyan-50 p-5 rounded-lg border-2 border-teal-200'>
                        <h4 className='text-sm font-semibold text-teal-700 mb-1'>RegUp</h4>
                        <p className='text-2xl font-bold text-teal-900'>${pnlTotals.RegUp?.toFixed(0) || '0'}</p>
                    </div>
                    <div className='bg-linear-to-br from-teal-50 to-cyan-50 p-5 rounded-lg border-2 border-teal-200'>
                        <h4 className='text-sm font-semibold text-teal-700 mb-1'>RegDown</h4>
                        <p className='text-2xl font-bold text-teal-900'>${pnlTotals.RegDown?.toFixed(0) || '0'}</p>
                    </div>
                    <div className='bg-linear-to-br from-teal-50 to-cyan-50 p-5 rounded-lg border-2 border-teal-200'>
                        <h4 className='text-sm font-semibold text-teal-700 mb-1'>Spin</h4>
                        <p className='text-2xl font-bold text-teal-900'>${pnlTotals.Spin?.toFixed(0) || '0'}</p>
                    </div>
                    <div className='bg-linear-to-br from-teal-50 to-cyan-50 p-5 rounded-lg border-2 border-teal-200'>
                        <h4 className='text-sm font-semibold text-teal-700 mb-1'>NonSpin</h4>
                        <p className='text-2xl font-bold text-teal-900'>${pnlTotals.NonSpin?.toFixed(0) || '0'}</p>
                    </div>
                </div>
            </div>

            {/* battery config */}
            <div className='mb-16'>
                <h3 className='text-2xl font-semibold mb-6 text-teal-800'>Battery Configuration</h3>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='bg-white p-5 rounded-lg border-2 border-teal-100'>
                        <h4 className='text-sm font-semibold text-gray-600 mb-1'>Energy Capacity</h4>
                        <p className='text-2xl font-bold text-teal-900'>10 MWh</p>
                    </div>
                    <div className='bg-white p-5 rounded-lg border-2 border-teal-100'>
                        <h4 className='text-sm font-semibold text-gray-600 mb-1'>Power Limit</h4>
                        <p className='text-2xl font-bold text-teal-900'>10 MW</p>
                    </div>
                    <div className='bg-white p-5 rounded-lg border-2 border-teal-100'>
                        <h4 className='text-sm font-semibold text-gray-600 mb-1'>Round-Trip Efficiency</h4>
                        <p className='text-2xl font-bold text-teal-900'>80%</p>
                    </div>
                    <div className='bg-white p-5 rounded-lg border-2 border-teal-100'>
                        <h4 className='text-sm font-semibold text-gray-600 mb-1'>Degradation Cost</h4>
                        <p className='text-2xl font-bold text-teal-900'>$5/MWh</p>
                    </div>
                </div>
            </div>

            {/* chart cards */}
            <div className='grid grid-cols-1 md:grid-cols-4 gap-8 mb-12'>
                {/* Energy Price */}
                <div className='bg-white border-2 border-teal-100 rounded-xl p-6 hover:shadow-xl transition-shadow duration-300'>
                    <div className='flex items-center justify-between mb-4'>
                        <h3 className='text-xl font-bold text-teal-900'>Energy Price</h3>
                    </div>
                    <p className='text-gray-600 mb-6'>Track real-time energy pricing trends and market fluctuations</p>
                    <Button
                        variant="outline"
                        className='w-full border-teal-400 text-teal-700 hover:bg-teal-50 hover:text-teal-500'
                        onClick={() => toggleChart('energy')}
                    >
                        {activeChart === 'energy' ? 'Hide Chart' : 'View Chart'}
                    </Button>
                </div>

                {/* State of Charge */}
                <div className='bg-white border-2 border-cyan-100 rounded-xl p-6 hover:shadow-xl transition-shadow duration-300'>
                    <div className='flex items-center justify-between mb-4'>
                        <h3 className='text-xl font-bold text-cyan-900'>State of Charge</h3>
                    </div>
                    <p className='text-gray-600 mb-6'>Monitor battery storage levels and charging patterns over time</p>
                    <Button
                        variant="outline"
                        className='w-full border-cyan-400 text-cyan-700 hover:bg-cyan-50 hover:text-teal-500'
                        onClick={() => toggleChart('soc')}
                    >
                        {activeChart === 'soc' ? 'Hide Chart' : 'View Chart'}
                    </Button>
                </div>

                {/* Reserves */}
                <div className='bg-white border-2 border-teal-100 rounded-xl p-6 hover:shadow-xl transition-shadow duration-300'>
                    <div className='flex items-center justify-between mb-4'>
                        <h3 className='text-xl font-bold text-teal-900'>Reserves</h3>
                    </div>
                    <p className='text-gray-600 mb-6'>Analyze reserve capacity and availability across the grid</p>
                    <Button
                        variant="outline"
                        className='w-full border-teal-400 text-teal-700 hover:bg-teal-50 hover:text-teal-500'
                        onClick={() => toggleChart('reserves')}
                    >
                        {activeChart === 'reserves' ? 'Hide Chart' : 'View Chart'}
                    </Button>
                </div>

                {/* Profit Forecast */}
                <div className='bg-white border-2 border-teal-100 rounded-xl p-6 hover:shadow-xl transition-shadow duration-300'>
                    <div className='flex items-center justify-between mb-4'>
                        <h3 className='text-xl font-bold text-teal-900'>Profit Forecast</h3>
                    </div>
                    <p className='text-gray-600 mb-6'>View predicted revenue and profit trends for upcoming periods</p>
                    <Button
                        variant="outline"
                        className='w-full border-teal-400 text-teal-700 hover:bg-teal-50 hover:text-teal-500'
                        onClick={() => toggleChart('profit')}
                    >
                        {activeChart === 'profit' ? 'Hide Chart' : 'View Chart'}
                    </Button>
                </div>
            </div>

            {/* Full width chart display */}
            {activeChart === 'energy' && (
                <div className='mb-12 bg-white rounded-xl p-8 border-2 border-teal-100 shadow-lg'>
                    <h3 className='text-2xl font-bold text-teal-900 mb-6'>Energy Price Over Time</h3>
                    <div style={{ height: '500px' }}>
                        <Line data={energyPriceData} options={chartOptions} />
                    </div>
                </div>
            )}

            {activeChart === 'soc' && (
                <div className='mb-12 bg-white rounded-xl p-8 border-2 border-cyan-100 shadow-lg'>
                    <h3 className='text-2xl font-bold text-cyan-900 mb-6'>Battery State of Charge</h3>
                    <div style={{ height: '500px' }}>
                        <Line data={socData} options={chartOptions} />
                    </div>
                </div>
            )}

            {activeChart === 'reserves' && (
                <div className='mb-12 bg-white rounded-xl p-8 border-2 border-teal-100 shadow-lg'>
                    <h3 className='text-2xl font-bold text-teal-900 mb-6'>Reserve Capacity Allocation</h3>
                    <div style={{ height: '500px' }}>
                        <Bar data={reservesData} options={chartOptions} />
                    </div>
                </div>
            )}

            {activeChart === 'profit' && (
                <div className='mb-12 bg-white rounded-xl p-8 border-2 border-teal-100 shadow-lg'>
                    <h3 className='text-2xl font-bold text-teal-900 mb-6'>Revenue by Product</h3>
                    <div style={{ height: '500px' }}>
                        <Bar data={profitData} options={chartOptions} />
                    </div>
                </div>
            )}
        </div>
    )
}

export default Analytics