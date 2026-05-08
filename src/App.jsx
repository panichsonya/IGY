import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Clock, Send, Users, Star, Check, AlertCircle } from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, getDoc, setDoc, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';

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
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [screen, setScreen] = useState('main'); // 'main', 'profile', 'editProfile', 'newRequest', or 'requestDetail'
  const [activeTab, setActiveTab] = useState('community'); // 'community' or 'myActivity'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [hasReachedOut, setHasReachedOut] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState([]);

  // Review system state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { requestId, requestTitle, revieweeName, reviewerName, role }
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewTags, setReviewTags] = useState([]);
  const [showReviewConfirmation, setShowReviewConfirmation] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null); // for read-only other-user profile
  const [pendingReviews, setPendingReviews] = useState([]); // non-intrusive nudge list

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
    category: '',
    dateNeeded: '',
    isDateRange: false,
    endDate: '',
    time: ''
  });
  
  // All data now lives in Firestore — state is populated by real-time listeners
  const [postedRequests, setPostedRequests] = useState([]);
  const [helpingRequests, setHelpingRequests] = useState([]);
  const [completedRequests, setCompletedRequests] = useState([]);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false);
  const [showRequestLimitModal, setShowRequestLimitModal] = useState(false);
  const [giveFormFromLimit, setGiveFormFromLimit] = useState(false);
  const [overrideUsed, setOverrideUsed] = useState(false);

  // Community Gives
  const [communityGives, setCommunityGives] = useState([]);
  const [giveForm, setGiveForm] = useState({ title: '', content: '', imageUrl: '' });

  // Reviews (loaded from Firestore)
  const [allReviews, setAllReviews] = useState([]);

  // Firestore real-time listeners — subscribe when user is logged in
  useEffect(() => {
    if (!loggedIn || !userProfile.nickname) return;

    // Listen to all non-completed requests (community feed + my posted + my helping)
    const requestsQuery = query(collection(db, 'requests'), where('status', 'in', ['open', 'accepted']));
    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const allRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPostedRequests(allRequests);
      setHelpingRequests(allRequests.filter(r => r.acceptedBy === userProfile.nickname && r.status === 'accepted'));
    });

    // Listen to completed requests for this user
    const completedQuery1 = query(collection(db, 'requests'), where('status', '==', 'completed'), where('userName', '==', userProfile.nickname));
    const completedQuery2 = query(collection(db, 'requests'), where('status', '==', 'completed'), where('acceptedBy', '==', userProfile.nickname));
    let completed1 = [], completed2 = [];
    const mergeCompleted = () => {
      const merged = [...completed1, ...completed2];
      const unique = merged.filter((r, i) => merged.findIndex(x => x.id === r.id) === i);
      setCompletedRequests(unique);
    };
    const unsubCompleted1 = onSnapshot(completedQuery1, (snapshot) => {
      completed1 = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeCompleted();
    });
    const unsubCompleted2 = onSnapshot(completedQuery2, (snapshot) => {
      completed2 = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeCompleted();
    });

    // Listen to community gives
    const givesQuery = query(collection(db, 'communityGives'), orderBy('postedAt', 'desc'));
    const unsubGives = onSnapshot(givesQuery, (snapshot) => {
      setCommunityGives(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to reviews
    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      setAllReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to notifications for this user
    const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', userProfile.nickname));
    const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to pending reviews for this user
    const pendingQuery = query(collection(db, 'pendingReviews'), where('userName', '==', userProfile.nickname));
    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setPendingReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRequests();
      unsubCompleted1();
      unsubCompleted2();
      unsubGives();
      unsubReviews();
      unsubNotifs();
      unsubPending();
    };
  }, [loggedIn, userProfile.nickname]);

  // Firebase auth state listener — loads profile from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user && !isTestMode) {
        const displayName = user.displayName || user.email.split('@')[0];
        // Check Firestore for existing profile
        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
        if (profileDoc.exists()) {
          const profile = { ...profileDoc.data(), uid: user.uid };
          setUserProfile(profile);
          setEditForm(profile);
          setUserName(profile.nickname || displayName);
          if (profile.overrideUsed) setOverrideUsed(true);
        } else {
          // New user — needs profile setup
          const newProfile = {
            nickname: displayName,
            ageRange: '',
            gender: '',
            email: user.email || '',
            neighborhood: '',
            phone: '',
            bio: '',
            uid: user.uid
          };
          setUserProfile(newProfile);
          setEditForm(newProfile);
          setUserName(displayName);
          setNeedsProfileSetup(true);
        }
        setLoggedIn(true);
      } else if (!isTestMode) {
        setLoggedIn(false);
        setUserName('');
      }
    });
    return () => unsubscribe();
  }, [isTestMode]);

  // Firestore real-time listeners replace localStorage polling — no sync code needed

  // Scroll to top whenever navigating to a new screen, switching tabs, or logging in
  React.useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [screen, activeTab, loggedIn]);

  // Update request form neighborhood when profile changes or when opening new request form
  React.useEffect(() => {
    if (screen === 'newRequest') {
      setRequestForm(prev => ({
        ...prev,
        neighborhood: userProfile.neighborhood
      }));
    }
  }, [screen, userProfile.neighborhood]);

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setUserProfile(editForm);
    setUserName(editForm.nickname);
    if (firebaseUser && !isTestMode) {
      await setDoc(doc(db, 'profiles', firebaseUser.uid), editForm);
    }
    if (needsProfileSetup) {
      setNeedsProfileSetup(false);
      setScreen('main');
    } else {
      setScreen('profile');
      alert('Profile updated successfully!');
    }
  };

  // Reciprocity limit logic
  const myRequestCount = postedRequests.filter(r => r.userName === userProfile.nickname).length
    + completedRequests.filter(r => r.userName === userProfile.nickname).length;
  // Helping someone with a request counts as a full give (unlocks 3 requests).
  // Community gives (recipes, memes, etc.) each unlock 1 additional request.
  const myHelpGiveCount = completedRequests.filter(r => r.acceptedBy === userProfile.nickname).length;
  const myCommunityGiveCount = communityGives.filter(g => g.userName === userProfile.nickname).length;
  const myGiveCount = myHelpGiveCount + myCommunityGiveCount;
  const requestsAllowed = (myHelpGiveCount + 1) * 3 + myCommunityGiveCount;
  const isAtRequestLimit = myRequestCount >= requestsAllowed;

  // Review tag options by role
  const HELPER_TAGS = ['Reliable', 'Friendly', 'On-time', 'Communicative'];
  const REQUESTER_TAGS = ['Clear communication', 'Respectful', 'Flexible', 'Grateful'];

  // Review helpers — allReviews is populated by Firestore real-time listener
  const getVisibleReviewsFor = (name) => {
    const aboutUser = allReviews.filter(r => r.revieweeName === name);
    return aboutUser.filter(review => {
      const counterpart = allReviews.find(
        r => r.requestId === review.requestId && r.reviewerName === name
      );
      return counterpart && !review.skipped;
    });
  };

  const getAggregateRating = (name) => {
    const visible = getVisibleReviewsFor(name);
    if (visible.length === 0) return { average: 0, count: 0 };
    const sum = visible.reduce((acc, r) => acc + r.stars, 0);
    return { average: Math.round((sum / visible.length) * 10) / 10, count: visible.length };
  };

  const resetReviewForm = () => {
    setReviewStars(0);
    setReviewTitle('');
    setReviewText('');
    setReviewTags([]);
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || reviewStars === 0 || !reviewTitle.trim()) return;

    // Remove any existing review from this reviewer for this reviewee
    const existing = allReviews.find(r => r.reviewerName === reviewTarget.reviewerName && r.revieweeName === reviewTarget.revieweeName);
    if (existing) {
      await deleteDoc(doc(db, 'reviews', existing.id));
    }

    await addDoc(collection(db, 'reviews'), {
      requestId: reviewTarget.requestId,
      requestTitle: reviewTarget.requestTitle,
      reviewerName: reviewTarget.reviewerName,
      revieweeName: reviewTarget.revieweeName,
      role: reviewTarget.role,
      stars: reviewStars,
      title: reviewTitle.trim(),
      text: reviewText.trim(),
      tags: reviewTags,
      skipped: false,
      createdAt: new Date().toISOString()
    });

    // Remove from pending reviews in Firestore
    const myPending = pendingReviews.filter(p => p.requestId === reviewTarget.requestId);
    for (const p of myPending) {
      if (p.id) await deleteDoc(doc(db, 'pendingReviews', p.id));
    }

    setShowReviewConfirmation(true);
  };

  const handleReviewConfirmationClose = () => {
    setShowReviewConfirmation(false);

    // pendingReviews is updated in real-time by Firestore listener
    if (pendingReviews.length > 0) {
      const next = pendingReviews[0];
      setReviewTarget({ requestId: next.requestId, requestTitle: next.requestTitle, revieweeName: next.otherUserName, reviewerName: userProfile.nickname, role: next.role });
      resetReviewForm();
    } else {
      setShowReviewModal(false);
      setReviewTarget(null);
      resetReviewForm();
      setScreen('main');
      setActiveTab('myActivity');
    }
  };

  const handleSkipReview = async () => {
    if (!reviewTarget) return;

    const existing = allReviews.find(r => r.reviewerName === reviewTarget.reviewerName && r.revieweeName === reviewTarget.revieweeName);
    if (existing) {
      await deleteDoc(doc(db, 'reviews', existing.id));
    }

    await addDoc(collection(db, 'reviews'), {
      requestId: reviewTarget.requestId,
      requestTitle: reviewTarget.requestTitle,
      reviewerName: reviewTarget.reviewerName,
      revieweeName: reviewTarget.revieweeName,
      role: reviewTarget.role,
      stars: 0,
      title: '',
      text: '',
      tags: [],
      skipped: true,
      createdAt: new Date().toISOString()
    });

    // Remove from pending reviews in Firestore
    const myPending = pendingReviews.filter(p => p.requestId === reviewTarget.requestId);
    for (const p of myPending) {
      if (p.id) await deleteDoc(doc(db, 'pendingReviews', p.id));
    }

    // Check remaining pending reviews (updated by listener)
    const remaining = pendingReviews.filter(p => p.requestId !== reviewTarget.requestId);
    if (remaining.length > 0) {
      const next = remaining[0];
      setReviewTarget({ requestId: next.requestId, requestTitle: next.requestTitle, revieweeName: next.otherUserName, reviewerName: userProfile.nickname, role: next.role });
      resetReviewForm();
    } else {
      setShowReviewModal(false);
      setReviewTarget(null);
      resetReviewForm();
      setScreen('main');
      setActiveTab('myActivity');
    }
  };

  const handleNewRequestClick = () => {
    if (isAtRequestLimit) {
      setShowRequestLimitModal(true);
      return;
    }
    setScreen('newRequest');
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasGivenToday = communityGives.some(
    g => g.userName === userProfile.nickname && g.postedAt.slice(0, 10) === todayStr
  );

  const handleCreateGive = async () => {
    if (!giveForm.title || !giveForm.content) {
      alert('Please add a title and something to share');
      return;
    }
    if (hasGivenToday) {
      alert('You can only share one positivity post per day. Come back tomorrow!');
      return;
    }
    await addDoc(collection(db, 'communityGives'), {
      title: giveForm.title,
      content: giveForm.content,
      imageUrl: giveForm.imageUrl,
      userName: userProfile.nickname,
      userInitial: userProfile.nickname[0].toUpperCase(),
      postedAt: new Date().toISOString()
    });
    setGiveForm({ title: '', content: '', imageUrl: '' });

    if (giveFormFromLimit) {
      setGiveFormFromLimit(false);
      setScreen('newRequest');
    } else {
      setScreen('main');
      setActiveTab('community');
    }
  };

  const handleCreateRequest = async () => {
    if (!requestForm.title || !requestForm.description || !requestForm.dateNeeded || !requestForm.category) {
      alert('Please fill in all required fields');
      return;
    }

    if (requestForm.isDateRange && !requestForm.endDate) {
      alert('Please provide an end date for the date range');
      return;
    }

    await addDoc(collection(db, 'requests'), {
      ...requestForm,
      userName: userProfile.nickname,
      userInitial: userProfile.nickname[0].toUpperCase(),
      userEmail: userProfile.email,
      userPhone: userProfile.phone,
      userId: firebaseUser?.uid || '',
      status: 'open',
      postedAt: new Date().toISOString()
    });

    setShowConfirmation(true);
  };

  const handleConfirmAccept = async () => {
    if (helpingRequests.some(r => r.id === selectedRequest.id)) {
      setShowAcceptModal(false);
      alert('You have already accepted this request!');
      return;
    }

    // Update request in Firestore
    await updateDoc(doc(db, 'requests', selectedRequest.id), {
      status: 'accepted',
      acceptedBy: userProfile.nickname,
      acceptedByUserId: firebaseUser?.uid || '',
      acceptedAt: new Date().toISOString()
    });

    // Create notification for the requester
    await addDoc(collection(db, 'notifications'), {
      userId: selectedRequest.userName,
      type: 'accepted',
      message: `${userProfile.nickname} has accepted your request "${selectedRequest.title}"`,
      requestId: selectedRequest.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    setShowAcceptModal(false);
    setShowAcceptConfirmation(true);
  };

  const handleCancelCommitment = async () => {
    // Revert request to open in Firestore
    await updateDoc(doc(db, 'requests', selectedRequest.id), {
      status: 'open',
      acceptedBy: null,
      acceptedByUserId: null,
      acceptedAt: null
    });

    setShowCancelConfirmation(true);
    setHasReachedOut(false);
  };

  const handleMarkComplete = async (isHelper) => {
    const now = new Date().toISOString();
    const requestRef = doc(db, 'requests', selectedRequest.id);

    // Get fresh data from Firestore to check other party's status
    const freshDoc = await getDoc(requestRef);
    const freshData = freshDoc.data();

    if (isHelper) {
      await updateDoc(requestRef, { helperConfirmed: true, helperConfirmedAt: now });
      const updatedRequest = { ...selectedRequest, ...freshData, helperConfirmed: true, helperConfirmedAt: now };
      setSelectedRequest(updatedRequest);

      if (freshData.requesterConfirmed) {
        moveToCompleted(updatedRequest);
      } else {
        alert(`Marked as complete! Waiting for ${selectedRequest.userName} to confirm.`);
        setScreen('main');
        setActiveTab('myActivity');
      }
    } else {
      await updateDoc(requestRef, { requesterConfirmed: true, requesterConfirmedAt: now });
      const updatedRequest = { ...selectedRequest, ...freshData, requesterConfirmed: true, requesterConfirmedAt: now };
      setSelectedRequest(updatedRequest);

      if (freshData.helperConfirmed) {
        moveToCompleted(updatedRequest);
      } else {
        alert(`Marked as complete! Waiting for ${selectedRequest.acceptedBy} to confirm.`);
        setScreen('main');
        setActiveTab('myActivity');
      }
    }
  };

  const moveToCompleted = async (request) => {
    const helperName = request.acceptedBy;
    const requesterName = request.userName;
    const otherUser = userProfile.nickname === helperName ? requesterName : helperName;

    // Update request status in Firestore
    await updateDoc(doc(db, 'requests', request.id), {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    // Create pending reviews for both users in Firestore
    const myRole = userProfile.nickname === helperName ? 'helper' : 'requester';
    await addDoc(collection(db, 'pendingReviews'), {
      userName: userProfile.nickname,
      requestId: request.id,
      requestTitle: request.title,
      otherUserName: otherUser,
      role: myRole,
      createdAt: new Date().toISOString()
    });

    if (otherUser) {
      const otherRole = myRole === 'helper' ? 'requester' : 'helper';
      await addDoc(collection(db, 'pendingReviews'), {
        userName: otherUser,
        requestId: request.id,
        requestTitle: request.title,
        otherUserName: userProfile.nickname,
        role: otherRole,
        createdAt: new Date().toISOString()
      });
    }

    // Show review modal
    setReviewTarget({ requestId: request.id, requestTitle: request.title, revieweeName: otherUser, reviewerName: userProfile.nickname, role: myRole });
    resetReviewForm();
    setShowReviewModal(true);
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
                <span>{getAggregateRating(userProfile.nickname).count > 0 ? getAggregateRating(userProfile.nickname).average : 'New'}</span>
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
                  if (firebaseUser && !isTestMode) {
                    signOut(auth);
                  }
                  setLoggedIn(false);
                  setUserName('');
                  setIsTestMode(false);
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

  // Profile is now loaded from Firestore in the auth state listener
  useState(() => {
  }, []);

  const handleEmailAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    if (!email || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged will handle setting loggedIn
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setAuthError('No account found with that email. Try signing up instead.');
      } else if (err.code === 'auth/wrong-password') {
        setAuthError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with that email already exists. Try logging in.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(err.message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle setting loggedIn
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in failed. Please try again.');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-3xl mb-4 shadow-lg animate-pulse">
            <Heart className="w-8 h-8 text-white" fill="white" />
          </div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (loggedIn && needsProfileSetup) {
    // Force new users to complete profile before accessing the app
    const isNewUserSetup = true;
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
        <div className="bg-white shadow-sm border-b border-slate-100 px-4 py-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>Welcome to IGY!</h1>
            <p className="text-slate-500 text-sm mt-1">Set up your profile to get started</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Display Name *</label>
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                  placeholder="What should people call you?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Age Range *</label>
                <select
                  value={editForm.ageRange}
                  onChange={(e) => setEditForm({ ...editForm, ageRange: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                >
                  <option value="">Select age range</option>
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
                >
                  <option value="">Select gender</option>
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Neighborhood *</label>
                <select
                  value={editForm.neighborhood}
                  onChange={(e) => setEditForm({ ...editForm, neighborhood: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                >
                  <option value="">Select your neighborhood</option>
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
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  <h2
                    className="text-xl font-bold text-slate-800 cursor-pointer hover:underline decoration-dotted"
                    style={{ fontFamily: 'Georgia, serif' }}
                    onClick={() => {
                      setViewingProfile({ nickname: selectedRequest.userName, initial: selectedRequest.userInitial, neighborhood: selectedRequest.neighborhood });
                      setScreen('viewProfile');
                    }}
                  >{selectedRequest.userName}</h2>
                  {(() => {
                    const rating = getAggregateRating(selectedRequest.userName);
                    return rating.count > 0 ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm text-slate-600">{rating.average} ({rating.count} {rating.count === 1 ? 'review' : 'reviews'})</span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">No reviews yet</p>
                    );
                  })()}
                </div>
              </div>

              {/* Request Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    {selectedRequest.title}
                  </h3>
                  {selectedRequest.category && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                      {selectedRequest.category === 'errand' ? '🛒 Errand' :
                       selectedRequest.category === 'favor' ? '🙏 Favor' :
                       selectedRequest.category === 'home-help' ? '🏠 Home Help' :
                       selectedRequest.category === 'companionship' ? '💛 Check-in' :
                       selectedRequest.category}
                    </span>
                  )}
                  {selectedRequest.urgency && !selectedRequest.category && (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedRequest.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      selectedRequest.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                      selectedRequest.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {selectedRequest.urgency.toUpperCase()} PRIORITY
                    </span>
                  )}
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
                      <p className="text-sm text-blue-900 font-semibold mb-1">✓ You confirmed this is complete</p>
                      <p className="text-sm text-blue-800">
                        Waiting for {selectedRequest.userName} to confirm...
                      </p>
                    </div>
                  ) : selectedRequest.requesterConfirmed ? (
                    <>
                      <div className="bg-green-50 rounded-2xl p-4 mb-4 border-2 border-green-200">
                        <p className="text-sm text-green-900 font-semibold">
                          {selectedRequest.userName} has marked this as complete!
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkComplete(true)}
                        className="w-full bg-gradient-to-r from-green-400 to-emerald-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all mb-3"
                      >
                        Confirm Completion
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleMarkComplete(true)}
                      className="w-full bg-gradient-to-r from-green-400 to-emerald-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all mb-3"
                    >
                      Mark as Complete
                    </button>
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
                  </div>

                  {selectedRequest.requesterConfirmed ? (
                    <div className="bg-blue-50 rounded-2xl p-4 mb-4 border-2 border-blue-200">
                      <p className="text-sm text-blue-900 font-semibold mb-1">✓ You confirmed this is complete</p>
                      <p className="text-sm text-blue-800">
                        Waiting for {selectedRequest.acceptedBy} to confirm...
                      </p>
                    </div>
                  ) : selectedRequest.helperConfirmed ? (
                    <>
                      <div className="bg-green-50 rounded-2xl p-4 mb-4 border-2 border-green-200">
                        <p className="text-sm text-green-900 font-semibold">
                          {selectedRequest.acceptedBy} has marked this as complete!
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkComplete(false)}
                        className="w-full bg-gradient-to-r from-green-400 to-emerald-400 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
                      >
                        Confirm Completion
                      </button>
                    </>
                  ) : (
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

          {/* Request Limit Modal */}
          {showRequestLimitModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full">
                <div className="text-center mb-5">
                  <div className="text-5xl mb-3">🤝</div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    Request Limit Reached
                  </h2>
                  <p className="text-slate-600 text-sm">
                    You've used {myRequestCount} of {requestsAllowed} requests. Give back to the community to unlock more!
                  </p>
                </div>
                <div className="space-y-3">
                  {/* Contribute option */}
                  <div className="border-2 border-green-200 rounded-2xl p-4 hover:border-green-400 transition-all">
                    <button
                      onClick={() => {
                        setShowRequestLimitModal(false);
                        setGiveFormFromLimit(true);
                        setScreen('giveForm');
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌟</span>
                        <span className="font-bold text-slate-800 text-base">Contribute</span>
                      </div>
                      <p className="text-slate-500 text-sm">
                        Share a recipe, a meme, a joke, or something happy to the community feed. This counts as a give and unlocks your next request!
                      </p>
                    </button>
                  </div>

                  {/* Override option */}
                  <div className={`border-2 rounded-2xl p-4 transition-all ${overrideUsed ? 'border-slate-100 opacity-50' : 'border-orange-200 hover:border-orange-400'}`}>
                    <button
                      onClick={() => {
                        if (overrideUsed) return;
                        setOverrideUsed(true);
                        if (firebaseUser) setDoc(doc(db, 'profiles', firebaseUser.uid), { overrideUsed: true }, { merge: true });
                        setShowRequestLimitModal(false);
                        setScreen('newRequest');
                      }}
                      disabled={overrideUsed}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">⚡</span>
                        <span className="font-bold text-slate-800 text-base">Override</span>
                      </div>
                      <p className="text-slate-500 text-sm">
                        {overrideUsed
                          ? 'You have already used your one-time override.'
                          : 'This is very urgent and I need to post now. Warning: you can only use this override once — ever.'}
                      </p>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowRequestLimitModal(false)}
                    className="w-full text-slate-400 py-2 text-sm hover:text-slate-600 transition-all"
                  >
                    Go back
                  </button>
                </div>
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

    if (screen === 'giveForm') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          <Header showBackButton={true} onBack={() => setScreen('main')} />
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🌟</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>Share Something Positive</h2>
                <p className="text-slate-500 text-sm">A little light goes a long way. Share a joke, a meme link, a kind word — anything that might brighten someone's day.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={giveForm.title}
                    onChange={(e) => setGiveForm({ ...giveForm, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    placeholder="e.g., A joke to start your day"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your message *</label>
                  <textarea
                    value={giveForm.content}
                    onChange={(e) => setGiveForm({ ...giveForm, content: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors h-32 resize-none"
                    placeholder="Share a joke, an uplifting quote, a funny story..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Add an image (optional)</label>
                  <div className="relative">
                    {giveForm.imageUrl ? (
                      <div className="relative">
                        <img
                          src={giveForm.imageUrl}
                          alt="Preview"
                          className="w-full max-h-48 object-cover rounded-xl border-2 border-slate-200"
                        />
                        <button
                          onClick={() => setGiveForm({ ...giveForm, imageUrl: '' })}
                          className="absolute top-2 right-2 bg-white bg-opacity-90 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center shadow hover:bg-red-50 hover:text-red-500 transition-all text-lg font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition-all">
                        <div className="text-3xl mb-1">📷</div>
                        <p className="text-sm text-slate-500">Tap to upload a photo</p>
                        <p className="text-xs text-slate-400 mt-1">JPEG, PNG, GIF supported</p>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              alert('Image must be under 5MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setGiveForm({ ...giveForm, imageUrl: ev.target.result });
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setGiveFormFromLimit(false); setScreen('main'); }}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  {hasGivenToday && (
                    <p className="text-amber-600 text-sm text-center w-full mb-2">You've already shared a positivity post today. Come back tomorrow!</p>
                  )}
                  <button
                    onClick={handleCreateGive}
                    disabled={hasGivenToday}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${hasGivenToday ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-400 to-emerald-500 text-white hover:shadow-lg'}`}
                  >
                    Share with Community
                  </button>
                </div>

              </div>
            </div>
          </div>
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
                    category: '',
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">What kind of help do you need? *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'errand', label: 'Errand', icon: '🛒', desc: 'Prescription pickup, grocery run, ride to appointment' },
                      { value: 'favor', label: 'Favor', icon: '🙏', desc: 'A one-off ask that doesn\'t fit the other categories' },
                      { value: 'home-help', label: 'Home Help', icon: '🏠', desc: 'A one-off task you can\'t do right now' },
                      { value: 'companionship', label: 'Check-in', icon: '💛', desc: 'Phone call, text, or someone to stop by' }
                    ].map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setRequestForm({ ...requestForm, category: cat.value })}
                        className={`p-3 rounded-xl text-left transition-all border-2 ${
                          requestForm.category === cat.value
                            ? 'border-rose-400 bg-rose-50 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{cat.icon}</span>
                          <span className="font-semibold text-slate-800 text-sm">{cat.label}</span>
                        </div>
                        <p className="text-xs text-slate-500">{cat.desc}</p>
                      </button>
                    ))}
                  </div>
                  {requestForm.category === 'errand' && (
                    <p className="text-xs text-slate-400 mt-2 italic">Errands should be quick — 30 minutes or less. IGY is for neighbors helping neighbors, not a delivery or errand service.</p>
                  )}
                  {requestForm.category === 'home-help' && (
                    <p className="text-xs text-slate-400 mt-2 italic">Not a cleaning or maintenance service — just a one-off task you physically can't do right now.</p>
                  )}
                  {requestForm.category === 'companionship' && (
                    <p className="text-xs text-slate-400 mt-2 italic">A friendly check-in from a neighbor — not a substitute for professional support. If you're in crisis, please call <span className="font-semibold">988</span>.</p>
                  )}
                </div>

                {requestForm.category && (<>
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
                </>)}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (screen === 'editProfile') {
      const isNewUserSetup = needsProfileSetup;
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          {isNewUserSetup ? (
            <div className="bg-white shadow-sm border-b border-slate-100 px-4 py-4">
              <div className="max-w-2xl mx-auto text-center">
                <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>Welcome to IGY!</h1>
                <p className="text-slate-500 text-sm mt-1">Set up your profile to get started</p>
              </div>
            </div>
          ) : (
            <Header showBackButton={true} onBack={() => setScreen('profile')} />
          )}

          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{isNewUserSetup ? 'Display Name *' : 'Nickname'}</label>
                  <input
                    type="text"
                    value={editForm.nickname}
                    onChange={isNewUserSetup ? (e) => setEditForm({ ...editForm, nickname: e.target.value }) : undefined}
                    disabled={!isNewUserSetup}
                    className={isNewUserSetup
                      ? "w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                      : "w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"}
                    placeholder="What should people call you?"
                  />
                  {!isNewUserSetup && <p className="text-xs text-slate-500 mt-1">Nickname cannot be changed</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Age Range *</label>
                  <select
                    value={editForm.ageRange}
                    onChange={(e) => setEditForm({ ...editForm, ageRange: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                    required
                  >
                    <option value="">Select age range</option>
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
                    <option value="">Select gender</option>
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
                    <option value="">Select your neighborhood</option>
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
                  {isNewUserSetup ? 'Get Started' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (screen === 'viewProfile' && viewingProfile) {
      const vpRating = getAggregateRating(viewingProfile.nickname);
      const vpReviews = getVisibleReviewsFor(viewingProfile.nickname);
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
          <Header showBackButton={true} onBack={() => setScreen('main')} />

          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl text-white font-bold">{viewingProfile.nickname[0].toUpperCase()}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1" style={{ fontFamily: 'Georgia, serif' }}>{viewingProfile.nickname}</h2>
                {viewingProfile.neighborhood && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">{viewingProfile.neighborhood}</span>
                  </div>
                )}

                {vpRating.count > 0 ? (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="text-lg font-semibold text-slate-800">{vpRating.average}</span>
                    <span className="text-slate-500 text-sm">({vpRating.count} {vpRating.count === 1 ? 'review' : 'reviews'})</span>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm mt-3">No reviews yet</p>
                )}
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-4" style={{ fontFamily: 'Georgia, serif' }}>Reviews</h3>
              {vpReviews.length === 0 ? (
                <div className="text-center py-6">
                  <Star className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {vpReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(review => (
                    <div key={review.id} className="bg-slate-50 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-800 text-sm">{review.reviewerName}</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-3.5 h-3.5 ${s <= review.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="font-semibold text-slate-700 text-sm mb-1">{review.title}</p>
                      {review.text && <p className="text-slate-600 text-sm mb-2">{review.text}</p>}
                      {review.tags && review.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {review.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-xs font-medium">{tag}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-slate-400 text-xs">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
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
                
                {(() => {
                  const rating = getAggregateRating(userProfile.nickname);
                  return rating.count > 0 ? (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                      <span className="text-lg font-semibold text-slate-800">{rating.average}</span>
                      <span className="text-slate-500 text-sm">({rating.count} {rating.count === 1 ? 'review' : 'reviews'})</span>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm mt-3">No reviews yet</p>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 text-center border-2 border-green-100">
                  <p className="text-3xl font-bold text-green-700 mb-1">{myGiveCount}</p>
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
                  <div
                    className={`h-3 rounded-full ${isAtRequestLimit ? 'bg-red-400' : 'bg-gradient-to-r from-rose-400 to-orange-400'}`}
                    style={{ width: `${Math.min(100, (myRequestCount / requestsAllowed) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-600">
                  {isAtRequestLimit
                    ? `⚠️ Limit reached (${myRequestCount}/${requestsAllowed} requests). Share something positive to unlock more.`
                    : `✓ ${myRequestCount} of ${requestsAllowed} requests used — you're all set!`}
                </p>
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
                  if (firebaseUser && !isTestMode) {
                    signOut(auth);
                  }
                  setLoggedIn(false);
                  setUserName('');
                  setIsTestMode(false);
                  setScreen('main');
                }}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
              >
                Log Out
              </button>
            </div>

            {/* Reviews Section */}
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-4" style={{ fontFamily: 'Georgia, serif' }}>Reviews</h3>
              {(() => {
                const myReviews = getVisibleReviewsFor(userProfile.nickname);
                return myReviews.length === 0 ? (
                  <div className="text-center py-6">
                    <Star className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No reviews yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {myReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(review => (
                      <div key={review.id} className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-800 text-sm">{review.reviewerName}</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3.5 h-3.5 ${s <= review.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="font-semibold text-slate-700 text-sm mb-1">{review.title}</p>
                        {review.text && <p className="text-slate-600 text-sm mb-2">{review.text}</p>}
                        {review.tags && review.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {review.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-xs font-medium">{tag}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-slate-400 text-xs">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50">
        <Header />

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Notifications */}
          {notifications.filter(n => !n.read).length > 0 && (
            <div className="space-y-2 mb-4">
              {notifications.filter(n => !n.read).map(notif => (
                <div key={notif.id} className="bg-green-50 rounded-2xl p-4 border-2 border-green-200 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">🎉 {notif.message}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      updateDoc(doc(db, 'notifications', notif.id), { read: true });
                    }}
                    className="text-green-400 hover:text-green-600 text-lg font-bold flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

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
                  onClick={handleNewRequestClick}
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
              {/* Pending Reviews Nudge */}
              {pendingReviews.length > 0 && (
                <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-200">
                  <p className="text-sm font-semibold text-amber-800 mb-2">⭐ You have {pendingReviews.length === 1 ? 'a pending review' : `${pendingReviews.length} pending reviews`}</p>
                  {pendingReviews.map(p => (
                    <button
                      key={p.requestId}
                      onClick={() => {
                        setReviewTarget({ requestId: p.requestId, requestTitle: p.requestTitle, revieweeName: p.otherUserName, reviewerName: userProfile.nickname, role: p.role });
                        resetReviewForm();
                        setShowReviewModal(true);
                      }}
                      className="w-full text-left bg-white rounded-xl p-3 mb-2 last:mb-0 border border-amber-100 hover:shadow-sm transition-all"
                    >
                      <p className="text-sm font-medium text-slate-800">Review {p.otherUserName}</p>
                      <p className="text-xs text-slate-500">For: {p.requestTitle}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* My Requests Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>My Requests</h3>
                  <button
                    onClick={handleNewRequestClick}
                    className="bg-gradient-to-r from-rose-400 to-orange-400 text-white px-4 py-2 rounded-full font-semibold hover:shadow-lg transition-all text-sm flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    New
                  </button>
                </div>

                {/* Active Requests — action-needed first (accepted with requesterConfirmed pending), then by date */}
                <h4 className="text-sm font-semibold text-slate-600 mb-2">Active</h4>
                {postedRequests.filter(r => r.userName === userProfile.nickname && r.status !== 'completed').length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm mb-4">
                    <p className="text-slate-500 text-sm">You haven't posted any requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {postedRequests.filter(r => r.userName === userProfile.nickname && r.status !== 'completed')
                      .sort((a, b) => {
                        // Action-needed items first (accepted with helper confirmed, waiting for requester)
                        const aAction = a.status === 'accepted' && a.helperConfirmed && !a.requesterConfirmed ? 1 : 0;
                        const bAction = b.status === 'accepted' && b.helperConfirmed && !b.requesterConfirmed ? 1 : 0;
                        if (bAction !== aAction) return bAction - aAction;
                        // Then reverse chronological
                        return new Date(b.postedAt) - new Date(a.postedAt);
                      })
                      .map(request => (
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
                          <span className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2 bg-rose-50 text-rose-700">
                            {request.category === 'errand' ? '🛒 Errand' :
                             request.category === 'favor' ? '🙏 Favor' :
                             request.category === 'home-help' ? '🏠 Home Help' :
                             request.category === 'companionship' ? '💛 Check-in' :
                             request.urgency || request.category}
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
                    {completedRequests.filter(r => r.userName === userProfile.nickname)
                      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                      .map(request => (
                      <div key={request.id} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-slate-200">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-800 flex-1">{request.title}</h4>
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                            ✓ Completed
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm mb-2">Helped by: <span
                          className="font-semibold cursor-pointer hover:underline decoration-dotted"
                          onClick={() => {
                            setViewingProfile({ nickname: request.acceptedBy, neighborhood: request.neighborhood });
                            setScreen('viewProfile');
                          }}
                        >{request.acceptedBy}</span></p>
                        <p className="text-xs text-slate-400">
                          Completed {new Date(request.completedAt).toLocaleDateString()}
                        </p>
                        {(() => {
                          const allRevs = getAllReviews();
                          const myReview = allRevs.find(r => r.requestId === request.id && r.reviewerName === userProfile.nickname);
                          const theirReview = allRevs.find(r => r.requestId === request.id && r.reviewerName === request.acceptedBy);
                          if (!myReview) {
                            return (
                              <button
                                onClick={() => {
                                  setReviewTarget({ requestId: request.id, requestTitle: request.title, revieweeName: request.acceptedBy, reviewerName: userProfile.nickname, role: 'requester' });
                                  resetReviewForm();
                                  setShowReviewModal(true);
                                }}
                                className="mt-2 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                              >
                                ★ Leave a review
                              </button>
                            );
                          } else if (!theirReview) {
                            return <p className="mt-2 text-xs text-slate-400">✓ Review submitted — waiting for {request.acceptedBy}</p>;
                          } else if (!myReview.skipped && !theirReview.skipped) {
                            return (
                              <div className="flex items-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} className={`w-3 h-3 ${s <= theirReview.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                ))}
                                <span className="text-xs text-slate-500 ml-1">from {request.acceptedBy}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
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
                    {helpingRequests.filter(r => r.acceptedBy === userProfile.nickname)
                      .sort((a, b) => {
                        const liveA = postedRequests.find(r => r.id === a.id) || a;
                        const liveB = postedRequests.find(r => r.id === b.id) || b;
                        // Action-needed first (requester confirmed, helper hasn't)
                        const aAction = (liveA.requesterConfirmed || a.requesterConfirmed) && !(liveA.helperConfirmed || a.helperConfirmed) ? 1 : 0;
                        const bAction = (liveB.requesterConfirmed || b.requesterConfirmed) && !(liveB.helperConfirmed || b.helperConfirmed) ? 1 : 0;
                        if (bAction !== aAction) return bAction - aAction;
                        return new Date(b.acceptedAt || 0) - new Date(a.acceptedAt || 0);
                      })
                      .map(request => {
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
                              <span
                                className="font-semibold cursor-pointer hover:underline decoration-dotted"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingProfile({ nickname: request.userName, initial: request.userInitial, neighborhood: request.neighborhood });
                                  setScreen('viewProfile');
                                }}
                              >{request.userName}</span>
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
                    {completedRequests.filter(r => r.acceptedBy === userProfile.nickname)
                      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                      .map(request => (
                      <div key={request.id} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-slate-200">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-800 flex-1">{request.title}</h4>
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                            ✓ Completed
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm mb-2">Helped: <span
                          className="font-semibold cursor-pointer hover:underline decoration-dotted"
                          onClick={() => {
                            setViewingProfile({ nickname: request.userName, initial: request.userInitial, neighborhood: request.neighborhood });
                            setScreen('viewProfile');
                          }}
                        >{request.userName}</span></p>
                        <p className="text-xs text-slate-400">
                          Completed {new Date(request.completedAt).toLocaleDateString()}
                        </p>
                        {(() => {
                          const allRevs = getAllReviews();
                          const myReview = allRevs.find(r => r.requestId === request.id && r.reviewerName === userProfile.nickname);
                          const theirReview = allRevs.find(r => r.requestId === request.id && r.reviewerName === request.userName);
                          if (!myReview) {
                            return (
                              <button
                                onClick={() => {
                                  setReviewTarget({ requestId: request.id, requestTitle: request.title, revieweeName: request.userName, reviewerName: userProfile.nickname, role: 'helper' });
                                  resetReviewForm();
                                  setShowReviewModal(true);
                                }}
                                className="mt-2 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                              >
                                ★ Leave a review
                              </button>
                            );
                          } else if (!theirReview) {
                            return (
                              <p className="mt-2 text-xs text-slate-400">✓ Review submitted — waiting for {request.userName}</p>
                            );
                          } else if (!myReview.skipped && !theirReview.skipped) {
                            return (
                              <div className="flex items-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} className={`w-3 h-3 ${s <= theirReview.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                ))}
                                <span className="text-xs text-slate-500 ml-1">from {request.userName}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <>
              {postedRequests.filter(r => r.status !== 'accepted').length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No open requests right now</p>
                  <p className="text-slate-400 text-sm mt-2">Be the first to post a request or check back later!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedRequests.filter(r => r.status !== 'accepted').map(request => (
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
                      <div className="flex items-center gap-3 text-xs text-slate-500 ml-13 flex-wrap">
                        {request.category && (
                          <span className="px-2 py-0.5 rounded-full font-semibold bg-rose-50 text-rose-700">
                            {request.category === 'errand' ? '🛒 Errand' :
                             request.category === 'favor' ? '🙏 Favor' :
                             request.category === 'home-help' ? '🏠 Home Help' :
                             request.category === 'companionship' ? '💛 Check-in' :
                             request.category}
                          </span>
                        )}
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

          {/* Community Gives Section */}
          {activeTab === 'community' && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>
                  ✨ Community Gives
                </h3>
                <button
                  onClick={() => setScreen('giveForm')}
                  className="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-2 rounded-full font-semibold hover:shadow-lg transition-all text-sm flex items-center gap-1"
                >
                  + Share Positivity
                </button>
              </div>

              {communityGives.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
                  <div className="text-4xl mb-3">🌟</div>
                  <p className="text-slate-500 text-sm">No community gives yet — be the first to brighten someone's day!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {communityGives.map(give => (
                    <div key={give.id} className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">{give.userInitial}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{give.userName}</p>
                          <p className="text-xs text-slate-400">{new Date(give.postedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {give.imageUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-slate-100">
                          <img
                            src={give.imageUrl}
                            alt="Community give"
                            className="w-full max-h-64 object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <h4 className="font-semibold text-slate-800 mb-1">{give.title}</h4>
                      <p className="text-slate-600 text-sm whitespace-pre-line mb-2">{give.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Community Stats - shown in both tabs */}
          <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border-2 border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">✨ Your Community Stats</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-700">Times Given</p>
                <p className="text-2xl font-bold text-green-900">{myGiveCount}</p>
              </div>
              <div>
                <p className="text-green-700">Times Received</p>
                <p className="text-2xl font-bold text-green-900">{completedRequests.filter(r => r.userName === userProfile.nickname).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Request Limit Modal */}
        {showRequestLimitModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🤝</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                  Request Limit Reached
                </h2>
                <p className="text-slate-600 text-sm">
                  You've used {myRequestCount} of {requestsAllowed} requests. Give back to the community to unlock more!
                </p>
              </div>
              <div className="space-y-3">
                {/* Contribute option */}
                <div className="border-2 border-green-200 rounded-2xl p-4 hover:border-green-400 transition-all">
                  <button
                    onClick={() => {
                      setShowRequestLimitModal(false);
                      setGiveFormFromLimit(true);
                      setScreen('giveForm');
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🌟</span>
                      <span className="font-bold text-slate-800 text-base">Contribute</span>
                    </div>
                    <p className="text-slate-500 text-sm">
                      Share a recipe, a meme, a joke, or something happy to the community feed. This counts as a give and unlocks your next request!
                    </p>
                  </button>
                </div>

                {/* Override option */}
                <div className={`border-2 rounded-2xl p-4 transition-all ${overrideUsed ? 'border-slate-100 opacity-50' : 'border-orange-200 hover:border-orange-400'}`}>
                  <button
                    onClick={() => {
                      if (overrideUsed) return;
                      setOverrideUsed(true);
                      if (firebaseUser) setDoc(doc(db, 'profiles', firebaseUser.uid), { overrideUsed: true }, { merge: true });
                      setShowRequestLimitModal(false);
                      setScreen('newRequest');
                    }}
                    disabled={overrideUsed}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">⚡</span>
                      <span className="font-bold text-slate-800 text-base">Override</span>
                    </div>
                    <p className="text-slate-500 text-sm">
                      {overrideUsed
                        ? 'You have already used your one-time override.'
                        : 'This is very urgent and I need to post now. Warning: you can only use this override once — ever.'}
                    </p>
                  </button>
                </div>

                <button
                  onClick={() => setShowRequestLimitModal(false)}
                  className="w-full text-slate-400 py-2 text-sm hover:text-slate-600 transition-all"
                >
                  Go back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReviewModal && reviewTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              {showReviewConfirmation ? (
                /* Confirmation Screen */
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    Review Submitted!
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    Thank you for your feedback. Your review will be visible once {reviewTarget.revieweeName} submits theirs.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        handleReviewConfirmationClose();
                        setScreen('profile');
                      }}
                      className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      View My Profile
                    </button>
                    <button
                      onClick={handleReviewConfirmationClose}
                      className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* Review Form */
                <>
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-white font-bold text-2xl">{reviewTarget.revieweeName[0].toUpperCase()}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>
                      How was your experience with {reviewTarget.revieweeName}?
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">For: {reviewTarget.requestTitle}</p>
                  </div>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setReviewStars(star)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 ${star <= reviewStars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                  {reviewStars > 0 && (
                    <p className="text-center text-sm text-slate-500 mb-4">
                      {reviewStars === 1 ? 'Poor' : reviewStars === 2 ? 'Fair' : reviewStars === 3 ? 'Good' : reviewStars === 4 ? 'Great' : 'Excellent'}
                    </p>
                  )}

                  {/* Review Title */}
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value.slice(0, 50))}
                    placeholder="Review headline (required)"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors mb-1 text-sm"
                  />
                  <p className="text-xs text-slate-400 text-right mb-3">{reviewTitle.length}/50</p>

                  {/* Review Text */}
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
                    placeholder="Share your experience (optional)"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors text-sm resize-none mb-1"
                  />
                  <p className="text-xs text-slate-400 text-right mb-3">{reviewText.length}/500</p>

                  {/* Tags */}
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Tags (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {(reviewTarget.role === 'requester' ? HELPER_TAGS : REQUESTER_TAGS).map(tag => (
                        <button
                          key={tag}
                          onClick={() => setReviewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            reviewTags.includes(tag)
                              ? 'bg-gradient-to-r from-rose-400 to-orange-400 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSkipReview}
                      className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewStars === 0 || !reviewTitle.trim()}
                      className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                        reviewStars > 0 && reviewTitle.trim()
                          ? 'bg-gradient-to-r from-rose-400 to-orange-400 text-white hover:shadow-lg'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Submit Review
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 text-center mt-3">
                    Reviews are revealed after both parties submit
                  </p>
                </>
              )}
            </div>
          </div>
        )}
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
          {/* Google sign-in */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">Or use email</span>
            </div>
          </div>

          {/* Email/password form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setAuthError(''); }}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                autoComplete="email"
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-400 focus:outline-none transition-colors"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder={isSignUp ? 'Create a password (6+ characters)' : 'Your password'}
              />
            </div>

            {authError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{authError}</p>
              </div>
            )}

            <button
              onClick={handleEmailAuth}
              className="w-full bg-gradient-to-r from-rose-400 to-orange-400 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              {isSignUp ? 'Create Account' : 'Log In'}
            </button>
          </div>

          <div className="text-center mt-4">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
              className="text-slate-600 hover:text-slate-800 font-medium text-sm"
            >
              {isSignUp
                ? 'Already have an account? '
                : "Don't have an account? "}
              <span className="text-rose-500">{isSignUp ? 'Log in' : 'Sign up'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
