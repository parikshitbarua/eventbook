import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  ChevronRight,
  Calendar,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Globe,
  Award,
  Lock,
  MessageCircle,
  Ticket,
  Music,
  Heart,
  Star,
} from 'lucide-react';
import API_ENDPOINTS from "../config/api.config.ts";
import { colors } from "../config/global.themes.ts";

const trackPageView = async (userId: string, eventData: any = {}) => {
  try {
    const response = await fetch(API_ENDPOINTS.ADD_USER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        event_type: 'page_view',
        event_name: 'landing_page_view',
        event_data: eventData,
        page_url: window.location.pathname,
        user_agent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      console.error('Failed to track page view:', response.statusText);
    } else {
      const result = await response.json();
      console.log('Page view tracked successfully:', result);
    }
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    // Generate or retrieve user ID
    let storedUserId = localStorage.getItem('eventchain_user_id');
    
    if (!storedUserId) {
      // Generate new UUID for first-time visitor using proper uuid package
      storedUserId = uuidv4();
      localStorage.setItem('eventchain_user_id', storedUserId);
      console.log('Generated new user ID:', storedUserId);
    } else {
      console.log('Retrieved existing user ID:', storedUserId);
    }

    // Track landing page view
    trackPageView(storedUserId, {
      is_first_visit: !localStorage.getItem('eventchain_user_id'),
      referrer: document.referrer || 'direct',
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });

    // Set visibility for animations
    setIsVisible(true);
    
    // Feature rotation interval
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 10);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const trackButtonClick = (eventName: string, eventData: any = {}) => {
    // Get or generate user_id from localStorage (same as Header approach)
    let currentUserId = localStorage.getItem('eventchain_user_id');
    if (!currentUserId) {
      currentUserId = uuidv4();
      localStorage.setItem('eventchain_user_id', currentUserId);
    }

    const payload = JSON.stringify({
      user_id: currentUserId,
      event_type: 'button_click',
      event_name: eventName,
      event_data: eventData,
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });

    console.log('Attempting to track button click:', eventName);

    fetch(API_ENDPOINTS.ADD_EVENT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
    })
      .then(response => {
        if (response.ok) {
          console.log('Button click tracked successfully with fetch:', eventName);
          return response.json();
        } else {
          console.error('Button click tracking failed:', response.status, response.statusText);
          throw new Error(`HTTP ${response.status}`);
        }
      })
      .then(data => {
        console.log('Button click response:', data);
      })
      .catch(error => {
        console.error('Fetch failed, trying sendBeacon:', error);
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          const success = navigator.sendBeacon(API_ENDPOINTS.ADD_EVENT, blob);
          if (success) {
            console.log('Button click tracked successfully with sendBeacon');
          } else {
            console.error('Failed to track button click with sendBeacon');
          }
        }
      });
  };

  const handleLaunchAppClick = () => {
    trackButtonClick('launch_app_button_click', {
      button_location: 'navigation',
      timestamp: new Date().toISOString(),
    });
    navigate('/home');
  };

  const handleGetStartedClick = () => {
    trackButtonClick('get_started_button_click', {
      button_location: 'hero_section',
      timestamp: new Date().toISOString(),
    });
    navigate('/home');
  };

  const handleWatchDemoClick = () => {
    trackButtonClick('watch_demo_button_click', {
      button_location: 'hero_section',
      timestamp: new Date().toISOString(),
    });
    // Add demo functionality here
  };

  const handleTryItNowClick = () => {
    trackButtonClick('try_it_now_button_click', {
      button_location: 'how_it_works_section',
      timestamp: new Date().toISOString(),
    });
    navigate('/home');
  };

  const handleFinalLaunchClick = () => {
    trackButtonClick('final_launch_button_click', {
      button_location: 'cta_section',
      timestamp: new Date().toISOString(),
    });
    navigate('/home');
  };

  const features = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Complete Transparency',
      description:
        'All event details, profits, and organizer history stored immutably on-chain',
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Secondary Sales Revenue',
      description:
        'Organizers and artists earn from every resale on OpenSea, Blur, and other marketplaces',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Enhanced Liquidity',
      description:
        'Easily sell tickets on any NFT marketplace without social media hassles',
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: 'On-Chain Social',
      description:
        'Share reviews, feedback, and memories directly on the blockchain (coming soon!)',
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Proof of Attendance',
      description:
        'NFT tickets serve as permanent, verifiable proof you were there',
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: 'Dynamic Pricing',
      description:
        'Smart contracts enable demand-based pricing and automated revenue sharing',
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: 'Global Access',
      description:
        'No geographic restrictions - anyone with a wallet can participate worldwide',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Exclusive Communities',
      description:
        'NFT holders get special access to future events and exclusive perks',
    },
    {
      icon: <Lock className="w-8 h-8" />,
      title: 'Data Ownership',
      description: 'You own your event history and social interactions, not us',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Fraud Prevention',
      description:
        'Impossible to create counterfeit tickets - say goodbye to scams',
    },
  ];

  const FloatingCard = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
    <div
      className={`transform transition-all duration-1000 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );

  // Cartoon Animation Components - Distributed across the page
  const TicketAnimation1 = () => (
    <div
      className="absolute top-20 right-10 animate-bounce"
      style={{ animationDelay: '0s' }}
    >
      <div 
        className="w-12 h-8 rounded-lg border-3 border-white shadow-lg transform rotate-12"
        style={{ backgroundColor: colors.primary }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <Ticket className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );

  const TicketAnimation2 = () => (
    <div
      className="absolute top-1/3 left-5 animate-bounce"
      style={{ animationDelay: '1s' }}
    >
      <div 
        className="w-10 h-6 rounded-lg border-3 border-white shadow-lg transform -rotate-12"
        style={{ backgroundColor: colors.primary }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <Ticket className="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  );

  const EventAnimation1 = () => (
    <div
      className="absolute top-1/4 right-1/4 animate-pulse"
      style={{ animationDelay: '0.5s' }}
    >
      <div 
        className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
        style={{ backgroundColor: colors.primary }}
      >
        <Music className="w-6 h-6 text-white" />
      </div>
      <div 
        className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 animate-ping"
        style={{ borderColor: colors.primary }}
      ></div>
    </div>
  );

  const EventAnimation2 = () => (
    <div
      className="absolute bottom-1/3 left-1/4 animate-pulse"
      style={{ animationDelay: '2s' }}
    >
      <div 
        className="w-14 h-14 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
        style={{ backgroundColor: colors.primary }}
      >
        <Star className="w-5 h-5 text-white" />
      </div>
    </div>
  );

  const PeopleAnimation1 = () => (
    <div className="absolute top-1/2 right-5 flex space-x-1">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="w-8 h-8 rounded-full border-3 border-white shadow-lg animate-bounce flex items-center justify-center"
          style={{ 
            animationDelay: `${i * 0.3}s`,
            backgroundColor: colors.primary
          }}
        >
          <Heart className="w-4 h-4 text-white" />
        </div>
      ))}
    </div>
  );

  const PeopleAnimation2 = () => (
    <div className="absolute bottom-20 right-1/3 flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-full border-2 border-white shadow-lg animate-bounce flex items-center justify-center"
          style={{ 
            animationDelay: `${1 + i * 0.2}s`,
            backgroundColor: colors.primary
          }}
        >
          <Users className="w-3 h-3 text-white" />
        </div>
      ))}
    </div>
  );

  const FloatingElements = () => (
    <>
      <div
        className="absolute top-32 left-1/3 w-3 h-3 rounded-full border-2 border-white animate-ping"
        style={{ 
          animationDelay: '0s',
          backgroundColor: colors.primary
        }}
      ></div>
      <div
        className="absolute top-2/3 right-1/2 w-4 h-4 rounded-full border-2 border-white animate-pulse"
        style={{ 
          animationDelay: '1.5s',
          backgroundColor: colors.primary
        }}
      ></div>
      <div
        className="absolute bottom-1/4 left-1/2 w-2 h-2 rounded-full animate-bounce"
        style={{ 
          animationDelay: '2.5s',
          backgroundColor: colors.accent
        }}
      ></div>
      <div
        className="absolute top-3/4 left-10 w-3 h-3 rounded-full animate-ping"
        style={{ 
          animationDelay: '3s',
          backgroundColor: colors.accent
        }}
      ></div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-900 text-white overflow-hidden relative">
      {/* Distributed Animations */}
      <TicketAnimation1 />
      <TicketAnimation2 />
      <EventAnimation1 />
      <EventAnimation2 />
      <PeopleAnimation1 />
      <PeopleAnimation2 />
      <FloatingElements />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-zinc-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {/*<div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center border-2 border-white">*/}
            {/*    <Calendar className="w-5 h-5 text-white" />*/}
            {/*</div>*/}
            <span 
              className="text-3xl font-bold"
              style={{ color: colors.primary }}
            >
              eventChain
            </span>
          </div>
          <button
            onClick={handleLaunchAppClick}
            className="px-6 py-2 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 border-2 border-white text-white"
            style={{ backgroundColor: colors.primary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <FloatingCard>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 text-white leading-tight">
              Events
              <span 
                className="block"
                style={{ color: colors.primary }}
              >Reimagined</span>
            </h1>
          </FloatingCard>

          <FloatingCard delay={200}>
            <p className="text-xl md:text-2xl text-zinc-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              The first blockchain-powered event platform where transparency
              meets innovation. Create, discover, and attend events with NFT
              tickets that unlock a new world of possibilities.
            </p>
          </FloatingCard>

          <FloatingCard delay={400}>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
              <button
                onClick={handleGetStartedClick}
                className="px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 transform hover:scale-105 border-2 border-white text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                Get Started <ChevronRight className="w-5 h-5" />
              </button>
              <button 
                onClick={handleWatchDemoClick}
                className="px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 transform hover:scale-105 border-2"
                style={{ 
                  borderColor: colors.primary,
                  color: colors.primary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = colors.primary
                }}
              >
                Watch Demo
              </button>
            </div>
          </FloatingCard>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-zinc-900 to-zinc-800">
        <div className="max-w-7xl mx-auto">
          <FloatingCard delay={1200}>
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
              How <span style={{ color: colors.primary }}>eventChain</span> Works
            </h2>
            <p className="text-xl text-zinc-400 text-center mb-16 max-w-3xl mx-auto">
              Getting started is easier than ordering pizza! Here's how you can create or attend events in just 4 simple steps.
            </p>
          </FloatingCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Step 1 & 2 */}
            <div className="space-y-12">
              <FloatingCard delay={1400}>
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <span className="text-2xl font-bold text-white">1</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-3">Create Your Event</h3>
                    <p className="text-zinc-300 text-lg leading-relaxed">
                      Event organizers use our platform to create and list their events, just like Ticketmaster or Eventbrite.
                      The difference? Everything is stored on the blockchain, so ticket sales, event details, and attendance records
                      are completely transparent and can never be manipulated or hidden.
                    </p>
                  </div>
                </div>
              </FloatingCard>

              <FloatingCard delay={1600}>
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <span className="text-2xl font-bold text-white">2</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-3">Buy Your NFT Ticket</h3>
                    <p className="text-zinc-300 text-lg leading-relaxed">
                      Instead of regular tickets, you buy special digital tickets called NFTs.
                      It's like buying a concert ticket, but this one lives in your digital wallet and proves you own it - no one can steal or copy it!
                    </p>
                  </div>
                </div>
              </FloatingCard>
            </div>

            {/* Animated Visual for Steps 1 & 2 */}
            <div className="relative h-96 flex items-center justify-center">
              <div className="absolute inset-0">
                {/* Blockchain Background */}
                <div 
                  className="absolute inset-0 rounded-3xl border"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${colors.primary}33, transparent)`,
                    borderColor: `${colors.primary}4D`
                  }}
                ></div>

                {/* Step 1 Animation - Event Creation */}
                <div className="absolute top-8 left-8 animate-pulse">
                  <div 
                    className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  <div 
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full border-2 animate-ping"
                    style={{ borderColor: colors.primary }}
                  ></div>
                </div>

                {/* Arrow */}
                <div className="absolute top-20 left-32 animate-bounce" style={{ animationDelay: '0.5s' }}>
                  <ChevronRight className="w-8 h-8" style={{ color: colors.primary }} />
                </div>

                {/* Step 2 Animation - NFT Ticket */}
                <div className="absolute top-8 right-8 animate-bounce" style={{ animationDelay: '1s' }}>
                  <div 
                    className="w-20 h-14 rounded-lg border-4 border-white shadow-lg flex items-center justify-center transform rotate-6"
                    style={{ 
                      background: `linear-gradient(to right, ${colors.primary}, ${colors.primaryHover})`
                    }}
                  >
                    <Ticket className="w-8 h-8 text-white" />
                  </div>
                  <div 
                    className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full animate-pulse"
                    style={{ backgroundColor: colors.accent }}
                  ></div>
                </div>

                {/* Floating Elements */}
                <div 
                  className="absolute bottom-12 left-12 w-12 h-12 rounded-full border-2 animate-pulse" 
                  style={{ 
                    animationDelay: '2s',
                    backgroundColor: `${colors.primary}30`,
                    borderColor: colors.primary
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield className="w-6 h-6" style={{ color: colors.primary }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mt-20">
            {/* Animated Visual for Steps 3 & 4 */}
            <div className="relative h-96 flex items-center justify-center order-2 lg:order-1">
              <div className="absolute inset-0">
                {/* Background */}
                <div 
                  className="absolute inset-0 rounded-3xl border"
                  style={{ 
                    background: `linear-gradient(to bottom left, ${colors.primary}33, transparent)`,
                    borderColor: `${colors.primary}4D`
                  }}
                ></div>

                {/* Step 3 Animation - Phone with QR */}
                <div className="absolute top-8 left-8">
                  <div className="w-16 h-24 bg-gray-900 rounded-lg border-4 border-white shadow-lg relative">
                    <div className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 rounded-md p-2">
                      <div className="w-full h-full bg-white rounded border animate-pulse flex items-center justify-center">
                        <div className="w-8 h-8 bg-black opacity-80 grid grid-cols-3 gap-0.5">
                          {[...Array(9)].map((_, i) => (
                              <div key={i} className={`w-full h-full ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                </div>

                {/* Arrow */}
                <div className="absolute top-32 left-28 animate-bounce" style={{ animationDelay: '0.5s' }}>
                  <ChevronRight className="w-8 h-8" style={{ color: colors.primary }} />
                </div>

                {/* Step 4 Animation - Scanner */}
                <div className="absolute top-8 right-8 animate-pulse" style={{ animationDelay: '1s' }}>
                  <div className="w-20 h-16 bg-gray-800 rounded-lg border-4 border-white shadow-lg relative">
                    <div 
                      className="absolute top-2 left-2 right-2 h-1 animate-pulse"
                      style={{ backgroundColor: colors.primary }}
                    ></div>
                    <div className="w-full h-full flex items-center justify-center">
                      <div 
                        className="w-8 h-8 border-2 rounded animate-spin"
                        style={{ borderColor: colors.primary }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Success Checkmark */}
                <div className="absolute bottom-8 right-12 animate-bounce" style={{ animationDelay: '2s' }}>
                  <div 
                    className="w-12 h-12 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.accent }}
                  >
                    <div className="w-6 h-6 border-b-2 border-r-2 border-white transform rotate-45 translate-x-0.5 -translate-y-0.5"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 & 4 */}
            <div className="space-y-12 order-1 lg:order-2">
              <FloatingCard delay={1800}>
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <span className="text-2xl font-bold text-white">3</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-3">Generate Your QR Code</h3>
                    <p className="text-gray-300 text-lg leading-relaxed">
                      On event day, open your digital wallet and create a special QR code from your NFT ticket.
                      It's like showing your ID - the code proves the ticket is really yours and hasn't been used before.
                    </p>
                  </div>
                </div>
              </FloatingCard>

              <FloatingCard delay={2000}>
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <span className="text-2xl font-bold text-white">4</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-3">Enter the Event</h3>
                    <p className="text-gray-300 text-lg leading-relaxed">
                      Walk up to the event entrance and show your QR code to the scanner - just like scanning groceries at a store!
                      If your ticket is valid, you're in. If someone tries to use a fake ticket, the scanner will know instantly.
                    </p>
                  </div>
                </div>
              </FloatingCard>
            </div>
          </div>

          {/* Bottom CTA */}
          <FloatingCard delay={2200}>
            <div 
              className="text-center mt-16 p-8 rounded-3xl border"
              style={{ 
                backgroundColor: `${colors.primary}1A`,
                borderColor: `${colors.primary}4D`
              }}
            >
              <h3 className="text-2xl font-bold text-white mb-4">
                That's It! Simple as 1-2-3-4 🎉
              </h3>
              <p className="text-gray-300 text-lg mb-6">
                No complex tech knowledge needed. If you can use a smartphone, you can use EventChain!
              </p>
              <button
                  onClick={handleTryItNowClick}
                  className="px-8 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 border-2 border-white text-white"
                  style={{ 
                    backgroundColor: colors.primary,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                Try It Now - It's Free!
              </button>
            </div>
          </FloatingCard>
        </div>
      </section>

      {/* Stats Section */}
      <section 
        className="py-20 px-6 border-y"
        style={{ 
          backgroundColor: `${colors.primary}1A`,
          borderColor: `${colors.primary}33`
        }}
      >
        <div className="max-w-7xl mx-auto">
          <FloatingCard delay={1400}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  100%
                </div>
                <div className="text-white">Transparent</div>
              </div>
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  0%
                </div>
                <div className="text-white">Hidden Fees</div>
              </div>
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  ∞
                </div>
                <div className="text-white">Scalability</div>
              </div>
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  24/7
                </div>
                <div className="text-white">Global Access</div>
              </div>
            </div>
          </FloatingCard>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <FloatingCard delay={600}>
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
              Why Choose <span style={{ color: colors.primary }}>eventChain</span>?
            </h2>
            <p className="text-xl text-gray-400 text-center mb-16 max-w-3xl mx-auto">
              Powered by blockchain technology, we're revolutionizing how events
              are created, managed, and experienced.
            </p>
          </FloatingCard>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FloatingCard key={index} delay={800 + index * 100}>
                <div
                  className="p-8 rounded-2xl backdrop-blur-sm border transition-all duration-500 transform hover:scale-105"
                  style={{
                    backgroundColor: currentFeature === index 
                      ? `${colors.primary}33` 
                      : 'rgba(255, 255, 255, 0.05)',
                    borderColor: currentFeature === index 
                      ? colors.primary 
                      : 'rgba(255, 255, 255, 0.2)',
                    boxShadow: currentFeature === index 
                      ? `0 25px 50px -12px ${colors.primary}33` 
                      : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (currentFeature !== index) {
                      e.currentTarget.style.borderColor = `${colors.primary}80`
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentFeature !== index) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    }
                  }}
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-4 transition-colors duration-500 border-2"
                    style={{
                      backgroundColor: currentFeature === index 
                        ? colors.primary 
                        : 'rgba(255, 255, 255, 0.1)',
                      color: currentFeature === index 
                        ? 'white' 
                        : 'rgb(209, 213, 219)',
                      borderColor: currentFeature === index 
                        ? 'white' 
                        : 'rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </FloatingCard>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section 
        className="py-20 px-6 border-y"
        style={{ 
          backgroundColor: `${colors.primary}1A`,
          borderColor: `${colors.primary}33`
        }}
      >
        <div className="max-w-7xl mx-auto">
          <FloatingCard delay={1400}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  100%
                </div>
                <div className="text-white">Transparent</div>
              </div>
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  0%
                </div>
                <div className="text-white">Hidden Fees</div>
              </div>
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  ∞
                </div>
                <div className="text-white">Scalability</div>
              </div>
              <div>
                <div 
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ color: colors.primary }}
                >
                  24/7
                </div>
                <div className="text-white">Global Access</div>
              </div>
            </div>
          </FloatingCard>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <FloatingCard delay={1600}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Join the{' '}
              <span style={{ color: colors.primary }}>Revolution</span>?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Be part of the future of events. Create, discover, and experience
              events like never before.
            </p>
            <button
              onClick={handleFinalLaunchClick}
              className="px-12 py-4 rounded-full font-semibold text-xl transition-all duration-300 transform hover:scale-110 border-2 border-white text-white"
              style={{ backgroundColor: colors.primary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
            >
              Launch eventChain
            </button>
          </FloatingCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>
            &copy; 2025 EventChain. Revolutionizing events with blockchain
            technology.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
