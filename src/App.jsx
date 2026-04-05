import React, { useState } from 'react';
import { Heart, MapPin, Clock, Send, Users, Star, Check, AlertCircle } from 'lucide-react';

const SEATTLE_NEIGHBORHOODS = [
  'Ballard', 'Capitol Hill', 'Central District', 'Downtown', 'Fremont',
  'Green Lake', 'Greenwood', 'Lake City', 'Madison Park', 'Magnolia',
  'Queen Anne', 'Ravenna', 'University District', 'Wallingford', 'West Seattle', 'Other'
];

const App = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [screen, setScreen] = useState('main'); // 'main', 'profile', 'editProfile', 'newRequest', or 'requestDetail'
  const [activeTab, setActiveTab] = useState('community'); // 'community' or 'myActivity'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [hasReachedOut, setHasReachedOut] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  
  // User profile data
  const [userProfile, setUserProfile] = useState({
    nickname: 'Sonya',
    ageRange: '30-39',
    gender: 'Female',
    email: 'sonya@gmail.com',
    neighborhood: 'Ballard',
    phone: '206-555-0123',
    bio: 'Love helping my community!'
  });
  
  // Edit form state
  const [editForm, setEditForm] = useState({...userProfile});
  
  // Request form state - will be updated when screen opens
  const [requestForm, setRequestForm] = useState({
    title: '',
    description: '',
    neighborhood: 'Ballard',
    urgency: 'medium',
    dateNeeded: '',
    isDateRange: false,
    endDate: '',
    time: ''
  });
  
  // Store posted requests
  const [postedRequests, setPostedRequests] = useState(() => {
    const saved = localStorage.getItem('igy_posted_requests');
    const savedRequests = saved ? JSON.parse(saved) : [];
    
    // Always include Jane Smith's test request if it doesn't exist
    const hasJaneRequest = savedRequests.some(r => r.id === 1000);
    if (!hasJaneRequest) {
      return [{
        id: 1000,
        title: 'Need ride to doctor appointment',
        description: 'I have a doctor appointment at Swedish Medical Center and need a ride there and back. Appointment is at 2:00 PM. Should take about 2 hours total.',
        neighborhood: 'Capitol Hill',
        urgency: 'high',
        dateNeeded: '2026-03-01',
        isDateRange: false,
        endDate: '',
        time: '14:00',
        userName: 'Jane Smith',
        userInitial: 'J',
        userEmail: 'jane.smith@email.com',
        userPhone: '206-555-0199',
        status: 'open',
        postedAt: new Date().toISOString()
      }, ...savedRequests];
    }
    return savedRequests;
  });
  
  // Store requests user is helping with (user-specific)
  const [helpingRequests, setHelpingRequests] = useState(() => {
    const saved = localStorage.getItem(`igy_helping_requests_${userProfile.nickname}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  // Store completed requests (user-specific)
  const [completedRequests, setCompletedRequests] = useState(() => {
    const saved = localStorage.getItem(`igy_completed_requests_${userProfile.nickname}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false);

  // Save requests to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('igy_posted_requests', JSON.stringify(postedRequests));
  }, [postedRequests]);

  // Save helping requests to localStorage (user-specific).
  // NOTE: userProfile.nickname is intentionally NOT in the dependency array.
  // If it were, switching users would fire this effect with the OLD user's data
  // and write it to the NEW user's localStorage key — corrupting their data.
  // The reload effect below handles refreshing data when the user switches.
  React.useEffect(() => {
    localStorage.setItem(`igy_helping_requests_${userProfile.nickname}`, JSON.stringify(helpingRequests));
  }, [helpingRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save completed requests to localStorage (user-specific) — same reasoning as above.
  React.useEffect(() => {
    localStorage.setItem(`igy_completed_requests_${userProfile.nickname}`, JSON.stringify(completedRequests));
  }, [completedRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload user-specific data from localStorage whenever the active user changes.
  // This ensures each user sees their own helpingRequests and completedRequests
  // rather than the previous user's stale state.
  React.useEffect(() => {
    const savedHelping = localStorage.getItem(`igy_helping_requests_${userProfile.nickname}`);
    setHelpingRequests(savedHelping ? JSON.parse(savedHelping) : []);

    const savedCompleted = localStorage.getItem(`igy_completed_requests_${userProfile.nickname}`);
    setCompletedRequests(savedCompleted ? JSON.parse(savedCompleted) : []);
  }, [userProfile.nickname]);

  // Sync state from localStorage changes made by other tabs.
  // Uses both the storage event (instant) and polling every 2s (reliable fallback).
  React.useEffect(() => {
    const syncFromStorage = () => {
      const helpingKey = `igy_helping_requests_${userProfile.nickname}`;
      const completedKey = `igy_completed_requests_${userProfile.nickname}`;

      const latestHelping = JSON.parse(localStorage.getItem(helpingKey) || '[]');
      const latestCompleted = JSON.parse(localStorage.getItem(completedKey) || '[]');
      const latestPosted = JSON.parse(localStorage.getItem('igy_posted_requests') || '[]');

      setHelpingRequests(prev => {
        const prevStr = JSON.stringify(prev);
        return JSON.stringify(latestHelping) !== prevStr ? latestHelping : prev;
      });
      setCompletedRequests(prev => {
        const prevStr = JSON.stringify(prev);
        return JSON.stringify(latestCompleted) !== prevStr ? latestCompleted : prev;
      });
      setPostedRequests(prev => {
        const prevStr = JSON.stringify(prev);
        return JSON.stringify(latestPosted) !== prevStr ? latestPosted : prev;
      });
    };

    window.addEventListener('storage', syncFromStorage);
    const interval = setInterval(syncFromStorage, 2000);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      clearInterval(interval);
    };
  }, [userProfile.nickname]);

  // Update request form neighborhood when profile changes or when opening new request form
  React.useEffect(() => {
    if (screen === 'newRequest') {
      setRequestForm(prev => ({
        ...prev,
        neighborhood: userProfile.neighborhood
      }));
    }
  }, [screen, userProfile.neighborhood]);

  const handleSaveProfile = (e) => {
    if (e) e.preventDefault();
    console.log('Saving profile:', editForm);
    setUserProfile(editForm);
    localStorage.setItem('igy_user_profile', JSON.stringify(editForm));
    setScreen('profile');
    alert('Profile updated successfully!');
  };

  const handleCreateRequest = () => {
    if (!requestForm.title || !requestForm.description || !requestForm.dateNeeded) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (requestForm.isDateRange && !requestForm.endDate) {
      alert('Please provide an end date for the date range');
      return;
    }
    
    // Create new request
    const newRequest = {
      id: Date.now(),
      ...requestForm,
      userName: userProfile.nickname,
      userInitial: userProfile.nickname[0].toUpperCase(),
      status: 'open',
      postedAt: new Date().toISOString()
    };
    
    // Add to posted requests
    setPostedRequests([newRequest, ...postedRequests]);
    
    // Show confirmation
    setShowConfirmation(true);
  };

  const handleConfirmAccept = () => {
    // Check if already accepted (prevent duplicates)
    if (helpingRequests.some(r => r.id === selectedRequest.id)) {
      setShowAcceptModal(false);
      alert('You have already accepted this request!');
      return;
    }
    
    // Update request status in postedRequests (keep it there for the requestor to see)
    const updatedRequests = postedRequests.map(r => 
      r.id === selectedRequest.id 
        ? { ...r, status: 'accepted', acceptedBy: userProfile.nickname, acceptedAt: new Date().toISOString() }
        : r
    );
    setPostedRequests(updatedRequests);
    
    // Add to helping requests with status 'accepted'
    const acceptedRequest = {
      ...selectedRequest,
      status: 'accepted',
      acceptedBy: userProfile.nickname,
      acceptedAt: new Date().toISOString()
    };
    setHelpingRequests([...helpingRequests, acceptedRequest]);
    
    // Close accept modal and show confirmation
    setShowAcceptModal(false);
    setShowAcceptConfirmation(true);
  };

  const handleCancelCommitment = () => {
    // Remove from helping requests
    const updatedHelping = helpingRequests.filter(r => r.id !== selectedRequest.id);
    setHelpingRequests(updatedHelping);
    
    // Repost to community feed
    const repostedRequest = {
      ...selectedRequest,
      status: 'open',
      acceptedBy: null,
      acceptedAt: null
    };
    setPostedRequests([repostedRequest, ...postedRequests]);
    
    // Show confirmation and reset state
    setShowCancelConfirmation(true);
    setHasReachedOut(false);
  };

  const handleMarkComplete = (isHelper) => {
    const now = new Date().toISOString();
    
    if (isHelper) {
      // Helper marking as complete
      const updatedHelping = helpingRequests.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, helperConfirmed: true, helperConfirmedAt: now }
          : r
      );
      setHelpingRequests(updatedHelping);
      
      // Also update in postedRequests so requestor sees the status
      const updatedPosted = postedRequests.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, helperConfirmed: true, helperConfirmedAt: now }
          : r
      );
      setPostedRequests(updatedPosted);
      
      // Update selected request for immediate UI feedback
      const updatedRequest = { ...selectedRequest, helperConfirmed: true, helperConfirmedAt: now };
      setSelectedRequest(updatedRequest);

      // Read freshest state from localStorage in case the requestor already confirmed
      // in another tab but the poll hasn't updated React state yet
      const freshPosted = JSON.parse(localStorage.getItem('igy_posted_requests') || '[]');
      const freshRequest = freshPosted.find(r => r.id === selectedRequest.id);
      const requesterAlreadyConfirmed = selectedRequest.requesterConfirmed || freshRequest?.requesterConfirmed;

      if (requesterAlreadyConfirmed) {
        // Both confirmed - move to completed
        moveToCompleted(updatedRequest);
      } else {
        alert(`Marked as complete! Waiting for ${selectedRequest.userName} to confirm.`);
        setScreen('main');
        setActiveTab('myActivity');
      }
    } else {
      // Requestor marking as complete
      const updatedRequests = postedRequests.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, requesterConfirmed: true, requesterConfirmedAt: now }
          : r
      );
      setPostedRequests(updatedRequests);
      
      // Also update in helpingRequests so helper sees the status
      const updatedHelping = helpingRequests.map(r =>
        r.id === selectedRequest.id
          ? { ...r, requesterConfirmed: true, requesterConfirmedAt: now }
          : r
      );
      setHelpingRequests(updatedHelping);

      // Update selected request for immediate UI feedback
      const updatedRequest = { ...selectedRequest, requesterConfirmed: true, requesterConfirmedAt: now };
      setSelectedRequest(updatedRequest);

      // Write requesterConfirmed to the helper's localStorage so they see the action item
      const helperName = selectedRequest.acceptedBy;
      if (helperName) {
        const helperKey = `igy_helping_requests_${helperName}`;
        const helperRequests = JSON.parse(localStorage.getItem(helperKey) || '[]');
        localStorage.setItem(helperKey, JSON.stringify(
          helperRequests.map(r => r.id === selectedRequest.id
            ? { ...r, requesterConfirmed: true, requesterConfirmedAt: now }
            : r
          )
        ));
      }

      // Read freshest state from localStorage in case the helper already confirmed
      // in another tab but the poll hasn't updated React state yet
      const freshPosted = JSON.parse(localStorage.getItem('igy_posted_requests') || '[]');
      const freshRequest = freshPosted.find(r => r.id === selectedRequest.id);
      const helperAlreadyConfirmed = selectedRequest.helperConfirmed || freshRequest?.helperConfirmed;

      if (helperAlreadyConfirmed) {
        // Both confirmed - move to completed
        moveToCompleted(updatedRequest);
      } else {
        alert(`Marked as complete! Waiting for ${selectedRequest.acceptedBy} to confirm.`);
        setScreen('main');
        setActiveTab('myActivity');
      }
    }
  };

  const moveToCompleted = (request) => {
    const completedRequest = {
      ...request,
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    const helperName = request.acceptedBy;
    const requesterName = request.userName;
    const otherUser = userProfile.nickname === helperName ? requesterName : helperName;

    // Update React state for this user
    setCompletedRequests([completedRequest, ...completedRequests]);
    setHelpingRequests(helpingRequests.filter(r => r.id !== request.id));

    // Write to igy_posted_requests immediately (before React effects run) so that
    // the polling in the other tab reads the already-removed request and doesn't
    // restore it back into active.
    const updatedPosted = postedRequests.filter(r => r.id !== request.id);
    setPostedRequests(updatedPosted);
    localStorage.setItem('igy_posted_requests', JSON.stringify(updatedPosted));

    // Update the other user's localStorage directly so their tab picks it up via polling.
    if (otherUser) {
      const otherHelpingKey = `igy_helping_requests_${otherUser}`;
      const otherHelping = JSON.parse(localStorage.getItem(otherHelpingKey) || '[]');
      localStorage.setItem(otherHelpingKey, JSON.stringify(otherHelping.filter(r => r.id !== request.id)));

      const otherCompletedKey = `igy_completed_requests_${otherUser}`;
      const otherCompleted = JSON.parse(localStorage.getItem(otherCompletedKey) || '[]');
      localStorage.setItem(otherCompletedKey, JSON.stringify([completedRequest, ...otherCompleted]));
    }

    // Show success message
    alert('Request completed! Both parties have confirmed.\n\nIn the full app, you would now rate each other.');

    // TODO: Show rating modal

    setScreen('main');
    setActiveTab('myActivity');
  };

  // Reusable Header Component
  const Header = ({ showBackButton = false, onBack = null }) => (
    <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && onBack ? (
            <button
              onClick={onBack}
              className="text-slate-600 hover:text-slate-800 flex items-center gap-2 text-xl mr-2"
            >
              ←
            </button>
          ) : null}
          <div 
            onClick={() => setScreen('main')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-orange-400 rounded-2xl flex items-center justify-center" style={{transform: 'rotate(3deg)'}}>
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>IGY</h1>
              <p className="text-xs text-slate-500">Seattle</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2"
          >
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">{userProfile.nickname}</p>
              <div className="flex items-center gap-1 text-xs text-amber-600 justify-end">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>4.8</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 font-semibold hover:bg-slate-200 transition-colors">
              {userProfile.nickname[0].toUpperCase()}
            </div>
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
              <button
                onClick={() => {
                  setScreen('profile');
                  setShowDropdown(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors text-slate-700"
              >
                My Profile
              </button>
              <button
                onClick={() => {
                  setLoggedIn(false);
                  setUserName('');
                  setShowDropdown(false);
                  setScreen('main');
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors text-slate-700"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Load profile from localStorage on mount
  useState(() => {
    const savedProfile = localStorage.getItem('igy_user_profile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setUserProfile(parsed);
      setEditForm(parsed);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Skip validation - go straight to logged in state
    setLoggedIn(true);
    setUserName('Sonya');
  };

  if (loggedIn) {
    if (screen === 'requestDetail' && selectedRequest) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          <Header showBackButton={true} onBack={() => setScreen('main')} />

          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              {/* User Info */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">{selectedRequest.userInitial}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>{selectedRequest.userName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm text-slate-600">4.5 (8 ratings)</span>
                  </div>
                </div>
              </div>

              {/* Request Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    {selectedRequest.title}
                  </h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedRequest.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                    selectedRequest.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                    selectedRequest.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedRequest.urgency.toUpperCase()} PRIORITY
                  </span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Location</p>
                      <p className="text-slate-600">{selectedRequest.neighborhood}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">When</p>
                      <p className="text-slate-600">
                        {selectedRequest.isDateRange 
                          ? `${new Date(selectedRequest.dateNeeded).toLocaleDateString()} - ${new Date(selectedRequest.endDate).toLocaleDateString()}`
                          : new Date(selectedRequest.dateNeeded).toLocaleDateString()}
                        {selectedRequest.time && ` at ${selectedRequest.time}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Description</p>
                  <p className="text-slate-600 leading-relaxed">{selectedRequest.description}</p>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedRequest.status === 'accepted' && selectedRequest.acceptedBy === userProfile.nickname ? (
                // Request you've accepted - show mark complete and cancel options
                <div>
                  {selectedRequest.helperConfirmed ? (
                    <div className="bg-blue-50 rounded-2xl p-4 mb-4 border-2 border-blue-200">
                      <p className="text-sm text-blue-900 font-semibold mb-1">✓ You marked this as complete</p>
                      <p className="text-sm text-blue-800">
                        Waiting for {selectedRequest.userName} to confirm completion...
                      </p>
                    </div>
                  ) : (
                    <>
                      {selectedRequest.requesterConfirmed && (
                        <div className="bg-green-50 rounded-2xl p-4 mb-4 border-2 border-green-200">
                          <p className="text-sm text-green-900 font-semibold">
                            {selectedRequest.userName} has marked this as complete. Please confirm once you've provided the help!
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => handleMarkComplete(true)}
                        className="w-full bg-gradient-to-r from-green-400 to-emerald-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all mb-3"
                      >
                        Mark as Complete
                      </button>
                    </>
                  )}

                  <div className="bg-amber-50 rounded-2xl p-4 mb-4 border-2 border-amber-200">
                    <div className="flex gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <p className="text-sm font-semibold text-amber-900">Need to Cancel?</p>
                    </div>
                    <p className="text-sm text-amber-800 mb-3">
                      We understand plans change, but {selectedRequest.userName} is counting on you. 
                      <strong> Please contact them first</strong> to let them know you can no longer help.
                    </p>
                    <div className="bg-white rounded-xl p-3 mb-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Contact Info:</p>
                      {selectedRequest.userEmail && (
                        <p className="text-sm text-slate-600 mb-1">📧 {selectedRequest.userEmail}</p>
                      )}
                      {selectedRequest.userPhone && (
                        <p className="text-sm text-slate-600">📱 {selectedRequest.userPhone}</p>
                      )}
                    </div>
                  </div>

                  {!hasReachedOut && (
                    <button 
                      onClick={() => setHasReachedOut(true)}
                      className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-all mb-3"
                    >
                      I have reached out to {selectedRequest.userName}
                    </button>
                  )}

                  <button 
                    onClick={handleCancelCommitment}
                    disabled={!hasReachedOut}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      hasReachedOut 
                        ? 'bg-red-500 text-white hover:bg-red-600 cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Cancel Commitment
                  </button>
                </div>
              ) : selectedRequest.status === 'accepted' && selectedRequest.userName === userProfile.nickname ? (
                // Your request that's been accepted - show mark complete (FOR REQUESTOR)
                <div>

                  <div className="bg-green-50 rounded-2xl p-4 mb-4 border-2 border-green-200">
                    <p className="text-sm text-green-900 mb-2">
                      <span className="font-semibold">{selectedRequest.acceptedBy}</span> has accepted your request!
                    </p>
                    {selectedRequest.requesterConfirmed ? (
                      <p className="text-sm text-green-800 font-semibold">
                        ✓ You marked this as complete. Waiting for {selectedRequest.acceptedBy} to confirm...
                      </p>
                    ) : selectedRequest.helperConfirmed ? (
                      <p className="text-sm text-green-800 font-semibold">
                        {selectedRequest.acceptedBy} has marked this as complete. Please confirm once the help is provided!
                      </p>
                    ) : (
                      <p className="text-sm text-green-800">
                        Once they've helped you, mark this request as complete.
                      </p>
                    )}
                  </div>
                  
                  {!selectedRequest.requesterConfirmed && (
                    <button 
                      onClick={() => handleMarkComplete(false)}
                      className="w-full bg-gradient-to-r from-green-400 to-emerald-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Mark as Complete
                    </button>
                  )}
                </div>
              ) : selectedRequest.userName !== userProfile.nickname && selectedRequest.status !== 'accepted' ? (
                // Open request from community - show accept button
                <button 
                  onClick={() => setShowAcceptModal(true)}
                  className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Accept Request
                </button>
              ) : selectedRequest.userName === userProfile.nickname ? (
                // Your own request
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-blue-800 text-sm font-medium">This is your request</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Accept Confirmation Modal */}
          {showAcceptModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full">
                <h2 className="text-2xl font-bold text-slate-800 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                  Confirm Acceptance
                </h2>

                <div className="bg-amber-50 rounded-2xl p-4 mb-4 border-2 border-amber-200">
                  <div className="flex gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-semibold text-amber-900">Important Reminder</p>
                  </div>
                  <p className="text-sm text-amber-800">
                    Please only accept if you're confident you can help at the time and place requested.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                  <h3 className="font-semibold text-slate-800 mb-2">Request Details:</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{selectedRequest.neighborhood}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">
                        {new Date(selectedRequest.dateNeeded).toLocaleDateString()}
                        {selectedRequest.time && ` at ${selectedRequest.time}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">By accepting:</span>
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4">
                    <li>• Your contact info will be shared with {selectedRequest.userName}</li>
                    <li>• You'll receive {selectedRequest.userName}'s contact info</li>
                    <li>• Please reach out promptly to coordinate details</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAcceptModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAccept}
                    className="flex-1 bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Confirm Accept
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Accept Success Confirmation Modal */}
          {showAcceptConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    Request Accepted!
                  </h2>
                  <p className="text-slate-600">
                    Thank you for helping the community! 🎉
                  </p>
                </div>

                <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2">What's Next:</h3>
                  <ol className="text-sm text-blue-800 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-semibold flex-shrink-0">1.</span>
                      <span>Check the "My Activity" tab to see {selectedRequest.userName}'s contact info</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold flex-shrink-0">2.</span>
                      <span>Reach out to them promptly to confirm details</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold flex-shrink-0">3.</span>
                      <span>Follow through on your commitment to help</span>
                    </li>
                  </ol>
                </div>

                <button
                  onClick={() => {
                    setShowAcceptConfirmation(false);
                    setActiveTab('myActivity');
                    setScreen('main');
                  }}
                  className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Go to My Activity
                </button>
              </div>
            </div>
          )}

          {/* Cancel Confirmation Modal */}
          {showCancelConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    Request Cancelled
                  </h2>
                  <p className="text-slate-600">
                    Your commitment has been cancelled.
                  </p>
                </div>

                <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-200">
                  <p className="text-sm text-blue-900 mb-2">
                    ✓ {selectedRequest.userName} has been notified
                  </p>
                  <p className="text-sm text-blue-900 mb-2">
                    ✓ Request reposted to Community Feed
                  </p>
                  <p className="text-sm text-blue-900">
                    ✓ Someone else can now accept this request
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowCancelConfirmation(false);
                    setScreen('main');
                    setActiveTab('myActivity');
                  }}
                  className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Back to My Activity
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (screen === 'newRequest') {
      if (showConfirmation) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>Request Posted!</h2>
              <p className="text-slate-600 mb-6">Your request has been posted to the community. Members in your area will be notified.</p>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setRequestForm({
                    title: '',
                    description: '',
                    neighborhood: userProfile.neighborhood,
                    urgency: 'medium',
                    dateNeeded: '',
                    isDateRange: false,
                    endDate: '',
                    time: ''
                  });
                  setScreen('main');
                }}
                className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Go Home
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          <Header showBackButton={true} onBack={() => setScreen('main')} />

          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Title *</label>
                  <input 
                    type="text" 
                    value={requestForm.title}
                    onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    placeholder="e.g., Need soup delivered while sick"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
                  <textarea 
                    value={requestForm.description}
                    onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors h-32 resize-none"
                    placeholder="Please provide details about what you need..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Neighborhood *</label>
                  <select 
                    value={requestForm.neighborhood}
                    onChange={(e) => setRequestForm({ ...requestForm, neighborhood: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  >
                    {SEATTLE_NEIGHBORHOODS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Urgency *</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                      { value: 'critical', label: 'Critical' }
                    ].map(level => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setRequestForm({ ...requestForm, urgency: level.value })}
                        className={`py-3 rounded-xl font-medium capitalize transition-all ${
                          requestForm.urgency === level.value
                            ? level.value === 'critical' 
                              ? 'bg-red-500 text-white shadow-md'
                              : level.value === 'high'
                              ? 'bg-orange-500 text-white shadow-md'
                              : level.value === 'medium'
                              ? 'bg-amber-500 text-white shadow-md'
                              : 'bg-green-500 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="dateRange"
                      checked={requestForm.isDateRange}
                      onChange={(e) => setRequestForm({ ...requestForm, isDateRange: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="dateRange" className="text-sm font-medium text-slate-700">
                      This is a date range
                    </label>
                  </div>

                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {requestForm.isDateRange ? 'Start Date *' : 'Date Needed *'}
                  </label>
                  <input 
                    type="date" 
                    value={requestForm.dateNeeded}
                    onChange={(e) => setRequestForm({ ...requestForm, dateNeeded: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  />

                  {requestForm.isDateRange && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 mb-2">End Date *</label>
                      <input 
                        type="date" 
                        value={requestForm.endDate}
                        onChange={(e) => setRequestForm({ ...requestForm, endDate: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time (Optional)</label>
                  <input 
                    type="time" 
                    value={requestForm.time}
                    onChange={(e) => setRequestForm({ ...requestForm, time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    placeholder="e.g., 2:00 PM"
                  />
                  <p className="text-xs text-slate-500 mt-1">Specify if you need help at a specific time (e.g., appointment pickup)</p>
                </div>

                <button 
                  onClick={handleCreateRequest}
                  className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Post Request
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (screen === 'editProfile') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          <Header showBackButton={true} onBack={() => setScreen('profile')} />

          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nickname</label>
                  <input 
                    type="text" 
                    value={editForm.nickname}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Nickname cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Age Range *</label>
                  <select 
                    value={editForm.ageRange}
                    onChange={(e) => setEditForm({ ...editForm, ageRange: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  >
                    {['18-29', '30-39', '40-49', '50-59', '60-69', '70+'].map(range => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gender *</label>
                  <select 
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  >
                    {['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                  <input 
                    type="email" 
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Neighborhood *</label>
                  <select 
                    value={editForm.neighborhood}
                    onChange={(e) => setEditForm({ ...editForm, neighborhood: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  >
                    {SEATTLE_NEIGHBORHOODS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number *</label>
                  <input 
                    type="tel" 
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bio (Optional)</label>
                  <textarea 
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors h-24 resize-none"
                    placeholder="Tell us a bit about yourself..."
                  />
                </div>

                <button 
                  onClick={() => handleSaveProfile()}
                  className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (screen === 'profile') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          <Header showBackButton={true} onBack={() => setScreen('main')} />

          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl text-white font-bold">{userProfile.nickname[0].toUpperCase()}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>{userProfile.nickname}</h2>
                <p className="text-slate-500 text-sm">{userProfile.ageRange} • {userProfile.gender}</p>
                <p className="text-slate-600">{userProfile.email}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-600">{userProfile.neighborhood}</span>
                </div>
                {userProfile.bio && (
                  <p className="text-slate-600 text-sm mt-3 italic">"{userProfile.bio}"</p>
                )}
                
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span className="text-lg font-semibold text-slate-800">4.8</span>
                  <span className="text-slate-500 text-sm">(15 ratings)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 text-center border-2 border-green-100">
                  <p className="text-3xl font-bold text-green-700 mb-1">{completedRequests.filter(r => r.acceptedBy === userProfile.nickname).length}</p>
                  <p className="text-sm text-green-600 font-medium">Times Given</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 text-center border-2 border-blue-100">
                  <p className="text-3xl font-bold text-blue-700 mb-1">{completedRequests.filter(r => r.userName === userProfile.nickname).length}</p>
                  <p className="text-sm text-blue-600 font-medium">Times Received</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                <p className="text-sm font-semibold text-slate-700 mb-2">Reciprocity Status</p>
                <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                  <div className="bg-gradient-to-r from-rose-400 to-orange-400 h-3 rounded-full" style={{ width: '100%' }}></div>
                </div>
                <p className="text-xs text-slate-600">✓ You're all set to post requests!</p>
              </div>

              <button 
                onClick={() => {
                  setEditForm({...userProfile});
                  setScreen('editProfile');
                }}
                className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all mb-3"
              >
                Edit Profile
              </button>

              <button 
                onClick={() => {
                  setLoggedIn(false);
                  setUserName('');
                  setScreen('main');
                }}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
        <Header />

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 bg-white rounded-2xl p-2 shadow-sm">
            <button
              onClick={() => setActiveTab('community')}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'community'
                  ? 'bg-gradient-to-r from-rose-400 to-orange-400 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Community Feed
            </button>
            <button
              onClick={() => setActiveTab('myActivity')}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'myActivity'
                  ? 'bg-gradient-to-r from-rose-400 to-orange-400 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              My Activity
            </button>
          </div>

          {/* Community Feed Tab */}
          {activeTab === 'community' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>Open Requests</h3>
                <button 
                  onClick={() => setScreen('newRequest')}
                  className="bg-gradient-to-r from-rose-400 to-orange-400 text-white px-5 py-2 rounded-full font-semibold hover:shadow-lg transition-all text-sm flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  New Request
                </button>
              </div>
            </>
          )}

          {/* My Activity Tab */}
          {activeTab === 'myActivity' && (
            <div className="space-y-6">
              {/* My Requests Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>My Requests</h3>
                  <button 
                    onClick={() => setScreen('newRequest')}
                    className="bg-gradient-to-r from-rose-400 to-orange-400 text-white px-4 py-2 rounded-full font-semibold hover:shadow-lg transition-all text-sm flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    New
                  </button>
                </div>
                
                {/* Active Requests */}
                <h4 className="text-sm font-semibold text-slate-600 mb-2">Active</h4>
                {postedRequests.filter(r => r.userName === userProfile.nickname && r.status !== 'completed').length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm mb-4">
                    <p className="text-slate-500 text-sm">You haven't posted any requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {postedRequests.filter(r => r.userName === userProfile.nickname && r.status !== 'completed').map(request => (
                      <div 
                        key={request.id} 
                        onClick={() => {
                          setSelectedRequest(request);
                          setHasReachedOut(false);
                          setScreen('requestDetail');
                        }}
                        className="bg-white rounded-2xl p-5 shadow-sm border-2 border-rose-200 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-800 text-lg flex-1">{request.title}</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2 ${
                            request.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                            request.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                            request.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {request.urgency}
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm mb-3">{request.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {request.neighborhood}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {request.isDateRange 
                              ? `${new Date(request.dateNeeded).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`
                              : new Date(request.dateNeeded).toLocaleDateString()}
                            {request.time && ` at ${request.time}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            request.status === 'accepted' 
                              ? 'text-blue-600 bg-blue-50' 
                              : 'text-green-600 bg-green-50'
                          }`}>
                            ● {request.status === 'accepted' ? `Accepted by ${request.acceptedBy}` : 'Open'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed Requests */}
                <h4 className="text-sm font-semibold text-slate-600 mb-2">Completed</h4>
                {completedRequests.filter(r => r.userName === userProfile.nickname).length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-slate-500 text-sm">No completed requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedRequests.filter(r => r.userName === userProfile.nickname).map(request => (
                      <div key={request.id} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-slate-200">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-800 flex-1">{request.title}</h4>
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                            ✓ Completed
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm mb-2">Helped by: <span className="font-semibold">{request.acceptedBy}</span></p>
                        <p className="text-xs text-slate-400">
                          Completed {new Date(request.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* I'm Helping Section */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4" style={{ fontFamily: 'Georgia, serif' }}>I'm Helping</h3>
                
                {/* Active Helps */}
                <h4 className="text-sm font-semibold text-slate-600 mb-2">In Progress</h4>
                {helpingRequests.filter(r => r.acceptedBy === userProfile.nickname).length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm mb-4">
                    <p className="text-slate-500 text-sm">You're not currently helping with any requests</p>
                    <p className="text-slate-400 text-xs mt-2">Browse the Community Feed to find ways to help!</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {helpingRequests.filter(r => r.acceptedBy === userProfile.nickname).map(request => {
                      // Look up live status from postedRequests (globally synced) so we
                      // immediately reflect when the requestor confirms, without waiting
                      // for helpingRequests to be updated from the other tab.
                      const liveData = postedRequests.find(r => r.id === request.id) || request;
                      const requesterConfirmed = liveData.requesterConfirmed || request.requesterConfirmed;
                      const helperConfirmed = liveData.helperConfirmed || request.helperConfirmed;
                      return (
                      <div
                        key={request.id}
                        onClick={() => {
                          setSelectedRequest({ ...request, ...liveData });
                          setHasReachedOut(false);
                          setScreen('requestDetail');
                        }}
                        className="bg-white rounded-2xl p-5 shadow-sm border-2 border-green-200 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-800 text-lg flex-1">{request.title}</h4>
                          {requesterConfirmed && !helperConfirmed ? (
                            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full flex-shrink-0 ml-2 animate-pulse">
                              ● Action Required
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                              ● Accepted
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-sm mb-3">{request.description}</p>

                        {/* Action item: requestor has confirmed, helper needs to confirm */}
                        {requesterConfirmed && !helperConfirmed && (
                          <div className="bg-orange-50 rounded-xl p-3 mb-3 border-2 border-orange-300">
                            <p className="text-xs font-bold text-orange-900 mb-1">⚡ {request.userName} has marked this complete!</p>
                            <p className="text-xs text-orange-800">Tap to open and confirm you've provided the help.</p>
                          </div>
                        )}

                        {/* Status indicator for confirmation */}
                        {request.helperConfirmed && (
                          <div className="bg-blue-50 rounded-xl p-3 mb-3 border border-blue-200">
                            <p className="text-xs text-blue-900">
                              ✓ You confirmed completion. Waiting for {request.userName} to confirm...
                            </p>
                          </div>
                        )}

                        {/* Contact Info - visible in list */}
                        <div className="bg-blue-50 rounded-xl p-3 mb-3 border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-2">Contact Info:</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-blue-800">
                              <span className="font-semibold">{request.userName}</span>
                            </p>
                            {request.userEmail && (
                              <p className="text-blue-700">📧 {request.userEmail}</p>
                            )}
                            {request.userPhone && (
                              <p className="text-blue-700">📱 {request.userPhone}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {request.neighborhood}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {request.isDateRange
                              ? `${new Date(request.dateNeeded).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`
                              : new Date(request.dateNeeded).toLocaleDateString()}
                            {request.time && ` at ${request.time}`}
                          </span>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}

                {/* Completed Helps */}
                <h4 className="text-sm font-semibold text-slate-600 mb-2">Completed</h4>
                {completedRequests.filter(r => r.acceptedBy === userProfile.nickname).length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-slate-500 text-sm">No completed helps yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedRequests.filter(r => r.acceptedBy === userProfile.nickname).map(request => (
                      <div key={request.id} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-slate-200">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-800 flex-1">{request.title}</h4>
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                            ✓ Completed
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm mb-2">Helped: <span className="font-semibold">{request.userName}</span></p>
                        <p className="text-xs text-slate-400">
                          Completed {new Date(request.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <>
              {postedRequests.filter(r => r.status !== 'accepted' && r.userName !== userProfile.nickname).length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No open requests right now</p>
                  <p className="text-slate-400 text-sm mt-2">Be the first to post a request or check back later!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedRequests.filter(r => r.status !== 'accepted' && r.userName !== userProfile.nickname).map(request => (
                    <div 
                      key={request.id} 
                      onClick={() => {
                        setSelectedRequest(request);
                        setHasReachedOut(false);
                        setScreen('requestDetail');
                      }}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">{request.userInitial}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 truncate">{request.title}</h4>
                          <p className="text-sm text-slate-500">{request.userName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 ml-13">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {request.neighborhood}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(request.dateNeeded).toLocaleDateString()}
                          {request.time && ` at ${request.time}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Community Stats - shown in both tabs */}
          <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border-2 border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">✨ Your Community Stats</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-700">Times Given</p>
                <p className="text-2xl font-bold text-green-900">{completedRequests.filter(r => r.acceptedBy === userProfile.nickname).length}</p>
              </div>
              <div>
                <p className="text-green-700">Times Received</p>
                <p className="text-2xl font-bold text-green-900">{completedRequests.filter(r => r.userName === userProfile.nickname).length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-rose-400 to-orange-400 rounded-3xl mb-4 shadow-lg" style={{transform: 'rotate(3deg)'}}>
            <Heart className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="text-5xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>IGY</h1>
          <p className="text-slate-600 text-lg">I Got You</p>
          <p className="text-slate-500 text-sm mt-1">Community support for singles & solo dwellers</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors" 
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors" 
                autoComplete="current-password"
              />
            </div>
            <button 
              onClick={() => {
                setLoggedIn(true);
                setUserName('Sonya');
              }}
              className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Log In
            </button>
          </div>

          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">Or continue with</span>
              </div>
            </div>
            <button 
              type="button"
              className="w-full bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors mb-2"
            >
              Google
            </button>
            <button 
              type="button"
              className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              Apple
            </button>
          </div>
        </div>

        <div className="text-center mb-4">
          <button type="button" className="text-slate-600 hover:text-slate-800 font-medium">
            Don't have an account? <span className="text-rose-500">Sign up</span>
          </button>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-blue-900 mb-3 text-center">Quick Test Login</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => {
                setUserProfile({
                  nickname: 'Sonya',
                  ageRange: '30-39',
                  gender: 'Female',
                  email: 'sonya@gmail.com',
                  neighborhood: 'Ballard',
                  phone: '206-555-0123',
                  bio: 'Love helping my community!'
                });
                setLoggedIn(true);
                setUserName('Sonya');
              }}
              className="flex-1 bg-white text-blue-700 py-2 px-3 rounded-lg font-semibold hover:bg-blue-100 transition-all"
            >
              Sonya
            </button>
            <button
              onClick={() => {
                setUserProfile({
                  nickname: 'Jane Smith',
                  ageRange: '40-49',
                  gender: 'Female',
                  email: 'jane.smith@email.com',
                  neighborhood: 'Capitol Hill',
                  phone: '206-555-0199',
                  bio: 'New to Seattle, grateful for this community!'
                });
                setLoggedIn(true);
                setUserName('Jane Smith');
              }}
              className="flex-1 bg-white text-rose-700 py-2 px-3 rounded-lg font-semibold hover:bg-rose-100 transition-all"
            >
              Jane
            </button>
          </div>
          <p className="text-xs text-blue-700 text-center">Sonya = Helper | Jane = Requestor</p>
        </div>
      </div>
    </div>
  );
};

export default App;
