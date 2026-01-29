import React, { useState, useContext } from 'react'
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { OptimizationContext } from '../context/OptimizationContext';
import Dashboard from './Dashboard';

function Upload() {
    const { setOptimizationData, setOptimizationComplete, optimizationComplete } = useContext(OptimizationContext);
    const [activeTab, setActiveTab] = useState('upload');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [formData, setFormData] = useState({
        csvFile: null,
        startDate: '',
        endDate: '',
        mcp: '10',
        mdp: '10',
        roundTripEfficiency: '0.80',
        fee: '1',
        initialSoc: '5',
        degradationCost: '5.0',
        asDuration: '1.0',
        reserveRamp: '',
        forecasting: false
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData({ ...formData, csvFile: file });
        setError(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSwitchChange = (checked) => {
        setFormData({ ...formData, forecasting: checked });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (activeTab === 'upload') {
                if (!formData.csvFile) {
                    setError('Please select a CSV file to upload');
                    setLoading(false);
                    return;
                }

                const uploadFormData = new FormData();
                uploadFormData.append('merged', formData.csvFile);
                uploadFormData.append('config', JSON.stringify({
                    mcp: parseFloat(formData.mcp),
                    mdp: parseFloat(formData.mdp),
                    roundTripEfficiency: parseFloat(formData.roundTripEfficiency),
                    fee: parseFloat(formData.fee),
                    initialSoc: parseFloat(formData.initialSoc),
                    degradationCost: parseFloat(formData.degradationCost),
                    asDuration: parseFloat(formData.asDuration),
                    reserveRamp: formData.reserveRamp ? parseFloat(formData.reserveRamp) : null
                }));

                uploadFormData.append('forecasting', formData.forecasting);

                const response = await axios.post('http://localhost:5000/api/optimize', uploadFormData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                // Store response data in context
                setOptimizationData(response.data);
                setSuccess('Optimization completed successfully!');
                setOptimizationComplete(true);
                console.log('Optimization results:', response.data);
            } else {
                const response = await axios.post('http://localhost:5000/api/optimize', {
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    forecasting: formData.forecasting,
                    config: {
                        mcp: parseFloat(formData.mcp),
                        mdp: parseFloat(formData.mdp),
                        roundTripEfficiency: parseFloat(formData.roundTripEfficiency),
                        fee: parseFloat(formData.fee),
                        initialSoc: parseFloat(formData.initialSoc),
                        degradationCost: parseFloat(formData.degradationCost),
                        asDuration: parseFloat(formData.asDuration),
                        reserveRamp: formData.reserveRamp ? parseFloat(formData.reserveRamp) : null
                    }
                });

                // Store response data in context
                setOptimizationData(response.data);
                setSuccess('Analytics generated successfully!');
                setOptimizationComplete(true);
                console.log('Analytics results:', response.data);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'An error occurred');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (optimizationComplete) {
        return <Dashboard />;
    }

    return (
       
 <div className='max-w-4xl w-full px-8'>
            <h2 className='text-4xl font-bold mb-4 text-center'>Get Market Analytics</h2>
            <p className='text-center text-teal-700 mb-12'>Upload your data or select a date range to analyze market performance</p>

            {/* tabs */}
            <div className='flex gap-4 mb-6'>
                <button
                    onClick={() => setActiveTab('upload')}
                    disabled={loading}
                    className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'upload'
                        ? 'bg-teal-600 text-white shadow-lg'
                        : 'bg-white text-teal-600 border-2 border-teal-200 hover:border-teal-400'
                        }`}
                >
                    Upload CSV Data
                </button>
                <button
                    onClick={() => setActiveTab('daterange')}
                    disabled={loading}
                    className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'daterange'
                        ? 'bg-teal-600 text-white shadow-lg'
                        : 'bg-white text-teal-600 border-2 border-teal-200 hover:border-teal-400'
                        }`}
                >
                    Select Date Range
                </button>
            </div>

            {error && (
                <div className='mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700'>
                    {error}
                </div>
            )}
            {success && (
                <div className='mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700'>
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className='bg-white rounded-xl shadow-lg p-8 border-2 border-teal-100'>
                {/* tab content */}
                {activeTab === 'upload' ? (
                    <div className='mb-8'>
                        <h3 className='text-2xl font-semibold mb-4 text-teal-800'>Upload Price Data</h3>
                        <div className='space-y-2'>
                            <Label htmlFor='csvFile' className='text-base'>CSV File</Label>
                            <Input
                                id='csvFile'
                                type='file'
                                accept='.csv'
                                onChange={handleFileChange}
                                className='cursor-pointer'
                                disabled={loading}
                            />
                            <p className='text-sm text-gray-500'>Upload merged price snapshot CSV (LMP + AS prices)</p>
                        </div>
                    </div>
                ) : (
                    <div className='mb-8'>
                        <h3 className='text-2xl font-semibold mb-4 text-teal-800'>Select Date Range</h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                            <div className='space-y-2'>
                                <Label htmlFor='startDate'>Start Date</Label>
                                <Input
                                    id='startDate'
                                    name='startDate'
                                    type='date'
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                    required
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='endDate'>End Date</Label>
                                <Input
                                    id='endDate'
                                    name='endDate'
                                    type='date'
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                    required
                                />
                            </div>
                        </div>
                        <p className='text-sm text-gray-500 mt-2'>Analytics will be generated for the selected date range</p>
                    </div>
                )}

                {/* battery params */}
                <div className='mb-8'>
                    <h3 className='text-2xl font-semibold mb-4 text-teal-800'>Battery Configuration</h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        <div className='space-y-2'>
                            <Label htmlFor='mcp'>Energy Capacity (MWh)</Label>
                            <Input
                                id='mcp'
                                name='mcp'
                                type='number'
                                step='0.1'
                                value={formData.mcp}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='mdp'>Power Limit (MW)</Label>
                            <Input
                                id='mdp'
                                name='mdp'
                                type='number'
                                step='0.1'
                                value={formData.mdp}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='roundTripEfficiency'>Round-Trip Efficiency</Label>
                            <Input
                                id='roundTripEfficiency'
                                name='roundTripEfficiency'
                                type='number'
                                step='0.01'
                                min='0'
                                max='1'
                                value={formData.roundTripEfficiency}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='fee'>Trade Fee ($/MWh)</Label>
                            <Input
                                id='fee'
                                name='fee'
                                type='number'
                                step='0.1'
                                value={formData.fee}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='initialSoc'>Initial State of Charge (MWh)</Label>
                            <Input
                                id='initialSoc'
                                name='initialSoc'
                                type='number'
                                step='0.1'
                                value={formData.initialSoc}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='degradationCost'>Degradation Cost ($/MWh)</Label>
                            <Input
                                id='degradationCost'
                                name='degradationCost'
                                type='number'
                                step='0.1'
                                value={formData.degradationCost}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='asDuration'>AS Duration (hours)</Label>
                            <Input
                                id='asDuration'
                                name='asDuration'
                                type='number'
                                step='0.1'
                                value={formData.asDuration}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='reserveRamp'>Reserve Ramp (MW/h) - Optional</Label>
                            <Input
                                id='reserveRamp'
                                name='reserveRamp'
                                type='number'
                                step='0.1'
                                placeholder='Leave empty for no limit'
                                value={formData.reserveRamp}
                                onChange={handleInputChange}
                                disabled={loading}
                            />
                        </div>
                    </div>
                </div>

                {/* submit with prediction toggle */}
                <div className='flex justify-center items-center gap-6'>
                    <div className='flex items-center gap-4 bg-teal-50 border border-teal-600 rounded-lg px-12 h-12'>
                        <Switch
                            id='predictions'
                            checked={formData.forecasting}
                            onCheckedChange={handleSwitchChange}
                            disabled={loading}
                        />
                        <Label htmlFor='predictions' className='text-base font-semibold text-teal-900 cursor-pointer'>
                            Generate Profit Predictions
                        </Label>
                    </div>

                    <Button
                        type='submit'
                        disabled={loading}
                        className='bg-teal-600 hover:bg-teal-700 text-white h-12 px-12 py-6 text-lg font-semibold hover:shadow-lg hover:shadow-teal-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        {loading ? (
                            <>
                                <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                                Processing...
                            </>
                        ) : (
                            activeTab === 'upload' ? 'Run Optimization' : 'Generate Analytics'
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default Upload

