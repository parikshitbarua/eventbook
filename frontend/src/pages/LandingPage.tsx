import React, { useState, useEffect } from 'react';
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

const LandingPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 10);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="w-12 h-8 bg-[#e43636] rounded-lg border-3 border-white shadow-lg transform rotate-12">
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
      <div className="w-10 h-6 bg-[#e43636] rounded-lg border-3 border-white shadow-lg transform -rotate-12">
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
      <div className="w-16 h-16 bg-[#e43636] rounded-full border-4 border-white shadow-lg flex items-center justify-center">
        <Music className="w-6 h-6 text-white" />
      </div>
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-[#e43636] animate-ping"></div>
    </div>
  );

  const EventAnimation2 = () => (
    <div
      className="absolute bottom-1/3 left-1/4 animate-pulse"
      style={{ animationDelay: '2s' }}
    >
      <div className="w-14 h-14 bg-[#e43636] rounded-full border-4 border-white shadow-lg flex items-center justify-center">
        <Star className="w-5 h-5 text-white" />
      </div>
    </div>
  );

  const PeopleAnimation1 = () => (
    <div className="absolute top-1/2 right-5 flex space-x-1">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="w-8 h-8 bg-[#e43636] rounded-full border-3 border-white shadow-lg animate-bounce flex items-center justify-center"
          style={{ animationDelay: `${i * 0.3}s` }}
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
          className="w-6 h-6 bg-[#e43636] rounded-full border-2 border-white shadow-lg animate-bounce flex items-center justify-center"
          style={{ animationDelay: `${1 + i * 0.2}s` }}
        >
          <Users className="w-3 h-3 text-white" />
        </div>
      ))}
    </div>
  );

  const FloatingElements = () => (
    <>
      <div
        className="absolute top-32 left-1/3 w-3 h-3 bg-[#e43636] rounded-full border-2 border-white animate-ping"
        style={{ animationDelay: '0s' }}
      ></div>
      <div
        className="absolute top-2/3 right-1/2 w-4 h-4 bg-[#e43636] rounded-full border-2 border-white animate-pulse"
        style={{ animationDelay: '1.5s' }}
      ></div>
      <div
        className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-white rounded-full animate-bounce"
        style={{ animationDelay: '2.5s' }}
      ></div>
      <div
        className="absolute top-3/4 left-10 w-3 h-3 bg-white rounded-full animate-ping"
        style={{ animationDelay: '3s' }}
      ></div>
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Distributed Animations */}
      <TicketAnimation1 />
      <TicketAnimation2 />
      <EventAnimation1 />
      <EventAnimation2 />
      <PeopleAnimation1 />
      <PeopleAnimation2 />
      <FloatingElements />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {/*<div className="w-8 h-8 bg-[#e43636] rounded-lg flex items-center justify-center border-2 border-white">*/}
            {/*    <Calendar className="w-5 h-5 text-white" />*/}
            {/*</div>*/}
            <span className="text-3xl font-bold text-[#e43636]">
              eventChain
            </span>
          </div>
          <button
            onClick={() => (window.location.href = '/home')}
            className="bg-[#e43636] hover:bg-[#e43636]/90 px-6 py-2 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 border-2 border-white text-white"
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
              <span className="block text-[#e43636]">Reimagined</span>
            </h1>
          </FloatingCard>

          <FloatingCard delay={200}>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              The first blockchain-powered event platform where transparency
              meets innovation. Create, discover, and attend events with NFT
              tickets that unlock a new world of possibilities.
            </p>
          </FloatingCard>

          <FloatingCard delay={400}>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
              <button
                onClick={() => (window.location.href = '/home')}
                className="bg-[#e43636] hover:bg-[#e43636]/90 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 transform hover:scale-105 border-2 border-white text-white flex items-center justify-center gap-2"
              >
                Get Started <ChevronRight className="w-5 h-5" />
              </button>
              <button className="border-2 border-[#e43636] text-[#e43636] hover:bg-[#e43636] hover:text-white px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 transform hover:scale-105">
                Watch Demo
              </button>
            </div>
          </FloatingCard>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <FloatingCard delay={600}>
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
              Why Choose <span className="text-[#e43636]">EventChain</span>?
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
                  className={`p-8 rounded-2xl backdrop-blur-sm border transition-all duration-500 transform hover:scale-105 ${
                    currentFeature === index
                      ? 'bg-[#e43636]/20 border-[#e43636] shadow-lg shadow-[#e43636]/20'
                      : 'bg-white/5 border-white/20 hover:border-[#e43636]/50'
                  }`}
                >
                  <div
                    className={`inline-flex p-3 rounded-xl mb-4 transition-colors duration-500 border-2 ${
                      currentFeature === index
                        ? 'bg-[#e43636] text-white border-white'
                        : 'bg-white/10 text-gray-300 border-white/20'
                    }`}
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
      <section className="py-20 px-6 bg-[#e43636]/10 border-y border-[#e43636]/20">
        <div className="max-w-7xl mx-auto">
          <FloatingCard delay={1400}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl md:text-5xl font-bold text-[#e43636] mb-2">
                  100%
                </div>
                <div className="text-white">Transparent</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-[#e43636] mb-2">
                  0%
                </div>
                <div className="text-white">Hidden Fees</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-[#e43636] mb-2">
                  ∞
                </div>
                <div className="text-white">Scalability</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-[#e43636] mb-2">
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
              <span className="text-[#e43636]">Revolution</span>?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Be part of the future of events. Create, discover, and experience
              events like never before.
            </p>
            <button
              onClick={() => (window.location.href = '/home')}
              className="bg-[#e43636] hover:bg-[#e43636]/90 px-12 py-4 rounded-full font-semibold text-xl transition-all duration-300 transform hover:scale-110 border-2 border-white text-white"
            >
              Launch EventChain
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
