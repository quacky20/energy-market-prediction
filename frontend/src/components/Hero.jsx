import React from 'react'
import { Button } from '@/components/ui/button'

function Hero() {
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
    };
    return (
        <div className='w-full max-w-7xl mx-auto px-6 py-16'>
            <div className='grid lg:grid-cols-2 gap-12 items-center'>
                {/* left */}
                <div className='space-y-6'>
                    <div className='inline-block px-4 py-2 border-2 border-teal-500 rounded-full'>
                        <span className='text-teal-500 font-semibold text-sm'>
                            Energy Market Intelligence
                        </span>
                    </div>

                    <h1 className='text-5xl lg:text-6xl font-bold text-gray-900 leading-tight'>
                        Optimize Energy Markets with{' '}
                        <span className='text-teal-600'>AI-Powered</span> Solutions
                    </h1>

                    <p className='text-lg text-gray-600 leading-relaxed'>
                        Intelligent energy market optimization using renewable energy sources,
                        battery storage systems, and ancillary services. Maximize revenue through
                        strategic energy arbitrage and real-time market participation.
                    </p>

                    <div className='flex gap-4 pt-4'>
                        <Button
                            onClick={() => scrollToSection('upload')}
                            className='bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 text-lg hover:shadow-lg hover:shadow-teal-500/20 transition-all animate-[bounce_1.5s_ease-out_infinite]'
                        >
                            Get Started
                        </Button>
                        <Button
                            onClick={() => scrollToSection('analytics')}
                            variant='outline'
                            className='border-teal-600 text-teal-600 hover:bg-teal-50 px-8 py-6 text-lg hover:text-teal-500 hover:shadow-lg hover:shadow-teal-500/20 transition-all duration-150'
                        >
                            View Analytics
                        </Button>
                    </div>
                </div>

                {/* right - hero image */}
                <div className='relative'>
                    <img
                        src='/hero-graph.png'
                        alt='Energy Market Analytics Dashboard'
                        className='w-full h-full object-cover pl-10'
                    />
                </div>
            </div>
        </div>
    )
}

export default Hero