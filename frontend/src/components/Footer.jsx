import React from 'react'
import { Github } from 'lucide-react'

function Footer() {
    return (
        <footer className='w-full bg-linear-to-br from-teal-900 to-cyan-900 text-white'>
            <div className='max-w-7xl mx-auto px-6 pt-12'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
                    {/* left */}
                    <div className='col-span-1 md:col-span-1'>
                        <h3 className='text-4xl font-bold mb-4 bg-linear-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent'>
                            NRG Market
                        </h3>
                        <p className='text-teal-100 mb-4'>
                            AI-powered energy market optimization platform for maximizing revenue through intelligent arbitrage.
                        </p>
                        <div className='inline-block px-3 py-1 bg-teal-800/50 rounded-full text-sm text-teal-200'>
                            Energy Market Intelligence
                        </div>
                    </div>

                    {/* center */}
                    <div>
                        <h4 className='text-lg font-semibold mb-4 text-teal-200'>Project</h4>
                        <ul className='space-y-2'>
                            <li>
                                <a href='#home' className='text-teal-100 hover:text-white transition-colors'>Overview</a>
                            </li>
                            <li>
                                <a href='#analytics' className='text-teal-100 hover:text-white transition-colors'>Analytics</a>
                            </li>
                            <li>
                                <a href='#upload' className='text-teal-100 hover:text-white transition-colors'>Upload Data</a>
                            </li>
                        </ul>
                    </div>

                    {/* right */}
                    <div>
                        <h4 className='text-lg font-semibold mb-4 text-teal-200'>Technology</h4>
                        <ul className='space-y-2 text-teal-100 text-sm'>
                            <li className='flex items-center gap-2'>
                                <span className='w-2 h-2 bg-teal-400 rounded-full'></span>
                                React + Vite
                            </li>
                            <li className='flex items-center gap-2'>
                                <span className='w-2 h-2 bg-cyan-400 rounded-full'></span>
                                TailwindCSS
                            </li>
                            <li className='flex items-center gap-2'>
                                <span className='w-2 h-2 bg-teal-400 rounded-full'></span>
                                Chart.js
                            </li>
                            <li className='flex items-center gap-2'>
                                <span className='w-2 h-2 bg-cyan-400 rounded-full'></span>
                                Python Backend
                            </li>
                        </ul>
                        <div className='mt-4 flex gap-3'>
                            <a href='https://github.com/quacky20/energy-market-prediction' target='_blank' className='h-9 bg-teal-800 hover:bg-teal-700 rounded-lg flex items-center justify-center transition-colors p-4 gap-2'>
                                <Github className='w-5 h-5' />
                                <span>Repository</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            {/* bottom bar */}
            <div className='mt-12 py-4 border-t border-teal-800 w-full flex justify-center'>
                <div className='flex flex-col md:flex-row justify-between items-center gap-4'>
                    <p className='text-teal-200 text-sm'>
                        © 2026
                    </p>
                </div>
            </div>
        </footer>
    )
}

export default Footer