"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Heart, Home, Users, Baby, Briefcase, Smile,
  Cake, GlassWater, Gift, HeartHandshake, Sparkles, GraduationCap, Home as HouseIcon,
  Leaf, BookOpen, Utensils, Plane, Laptop, Shirt, Lamp, Dumbbell,
  CheckCircle2, Loader2, Music, Gamepad2, Tv, Cat, Palette, Trees, Scissors, Target
} from "lucide-react";

type Recipient = "him" | "her" | "parent" | "child" | "sibling" | "co-worker" | "teacher/mentor" | "friend";
type Occasion = "birthday" | "anniversary" | "graduation" | "baby shower" | "wedding" | "valentine's day" | "promotion/retirement" | "house warming" | "mother's day" | "father's day";
type AgeGroup = "under12" | "13-19" | "20s" | "30s" | "40s" | "50+";
type Gender = "male" | "female" | "unknown";
type Interest = "tech & gadgets" | "fashion & accessories" | "books & reading" | "home & kitchen" | "fitness & wellness" | "outdoor/ adventure" | "art & crafts" | "music & instruments" | "gaming" | "gardening" | "movies & tv" | "travel" | "pets" | "home decor";
type Budget = "under-25" | "25-50" | "50-100" | "100-200" | "no-limit";

interface QuizState {
  recipient: Recipient | "";
  occasion: Occasion | "";
  ageGroup: AgeGroup | "";
  gender: Gender | "";
  interests: Interest[];
  budget: Budget | "";
}

const quizSteps = [
  { id: "occasion", title: "What's the occasion" },
  { id: "recipient", title: "Who is the gift for?" },
  { id: "ageGroup", title: "What is their age group?" },
  { id: "gender", title: "Gender" },
  { id: "interests", title: "What are some of their Hobbies or interests?" },
  { id: "budget", title: "What's your budget?" },
  { id: "email", title: "Where should we send the gifts?" }
];

const occasions = [
  { id: "birthday", label: "Birthday", icon: Cake },
  { id: "anniversary", label: "Anniversary", icon: GlassWater },
  { id: "graduation", label: "Graduation", icon: GraduationCap },
  { id: "baby shower", label: "Baby Shower", icon: Baby },
  { id: "wedding", label: "Wedding", icon: HeartHandshake },
  { id: "valentine's day", label: "Valentine's Day", icon: Heart },
  { id: "promotion/retirement", label: "Promotion/Retirement", icon: Briefcase },
  { id: "house warming", label: "House Warming", icon: HouseIcon },
  { id: "mother's day", label: "Mother's Day", icon: Heart },
  { id: "father's day", label: "Father's Day", icon: Briefcase },
];

const recipients = [
  { id: "him", label: "Him", icon: Heart },
  { id: "her", label: "Her", icon: Heart },
  { id: "parent", label: "Parent", icon: Home },
  { id: "child", label: "Child", icon: Baby },
  { id: "sibling", label: "Sibling", icon: Smile },
  { id: "co-worker", label: "Co-worker", icon: Briefcase },
  { id: "teacher/mentor", label: "Teacher/ Mentor", icon: BookOpen },
  { id: "friend", label: "Friend", icon: Users },
];

const ageGroups = [
  { id: "under12", label: "Under12" },
  { id: "13-19", label: "13-19" },
  { id: "20s", label: "20s" },
  { id: "30s", label: "30s" },
  { id: "40s", label: "40s" },
  { id: "50+", label: "50+" },
];

const genders = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "unknown", label: "Unknown" },
];

const interestsList = [
  { id: "tech & gadgets", label: "Tech & Gadgets", icon: Laptop },
  { id: "fashion & accessories", label: "Fashion & Accessories", icon: Shirt },
  { id: "books & reading", label: "books & Reading", icon: BookOpen },
  { id: "home & kitchen", label: "Home & Kitchen", icon: Utensils },
  { id: "fitness & wellness", label: "Fitness & Wellness", icon: Dumbbell },
  { id: "outdoor/ adventure", label: "Outdoor/ Adventure", icon: Trees },
  { id: "art & crafts", label: "Art & Crafts", icon: Palette },
  { id: "music & instruments", label: "Music & Instruments", icon: Music },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "gardening", label: "Gardening", icon: Leaf },
  { id: "movies & tv", label: "Movies & TV", icon: Tv },
  { id: "travel", label: "Travel", icon: Plane },
  { id: "pets", label: "Pets", icon: Cat },
  { id: "home decor", label: "Home Decor", icon: HouseIcon },
];

const budgets = [
  { id: "under-25", label: "Under $25" },
  { id: "25-50", label: "$25 – $50" },
  { id: "50-100", label: "$50 – $100" },
  { id: "100-200", label: "$100 – $200" },
  { id: "no-limit", label: "No limit" },
];

export function QuizFlow({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>({
    recipient: "",
    occasion: "",
    ageGroup: "",
    gender: "",
    interests: [],
    budget: "",
  });
  
  const [emailState, setEmailState] = useState({ firstName: "", email: userEmail || "" });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nextStep = () => {
    if (currentStepIndex === 5 && userEmail) {
      // Skip email capture if user is logged in
      submitQuiz(emailState.firstName, userEmail);
    } else if (currentStepIndex < quizSteps.length - 1) {
      setDirection("forward");
      setCurrentStepIndex(i => i + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setDirection("backward");
      setCurrentStepIndex(i => i - 1);
    }
  };

  const toggleInterest = (interestId: Interest) => {
    setQuizState(prev => {
      const isSelected = prev.interests.includes(interestId);
      if (isSelected) {
        return { ...prev, interests: prev.interests.filter(id => id !== interestId) };
      } else if (prev.interests.length < 3) {
        return { ...prev, interests: [...prev.interests, interestId] };
      }
      return prev;
    });
  };

  const submitQuiz = async (firstName: string, email: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...quizState,
          firstName,
          email
        })
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/results/${data.sessionId}`);
      } else {
        const errorData = await res.json().catch(() => ({ error: "Failed to submit quiz" }));
        console.error("Failed to submit quiz", errorData);
        setSubmitError(errorData.error || "Something went wrong. Please try again.");
        setIsSubmitting(false);
      }
    } catch(err: any) {
      console.error(err);
      setSubmitError(err.message || "Network error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (currentStepIndex) {
      case 0: return quizState.occasion !== "";
      case 1: return quizState.recipient !== "";
      case 2: return quizState.ageGroup !== "";
      case 3: return quizState.gender !== "";
      case 4: return quizState.interests.length > 0;
      case 5: return quizState.budget !== "";
      case 6: return emailState.firstName !== "" && emailState.email !== "" && emailState.email.includes("@");
      default: return false;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex justify-between text-xs font-semibold text-gray-400 mb-2 px-1">
          <span>Step {currentStepIndex + 1} of {userEmail ? 6 : 7}</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-accent transition-all duration-500 ease-in-out" 
            style={{ width: `${((currentStepIndex + 1) / (userEmail ? 6 : 7)) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-primary/5 p-6 sm:p-12 min-h-[400px] flex flex-col transition-all">
        <h2 className="text-3xl font-serif font-bold text-primary mb-8 text-center">
          {quizSteps[currentStepIndex].title}
        </h2>

        <div className="flex-grow">
          {currentStepIndex === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {occasions.map(o => (
                <button
                  key={o.id}
                  onClick={() => setQuizState(s => ({ ...s, occasion: o.id as Occasion }))}
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 ${quizState.occasion === o.id ? 'border-accent bg-accent/5 text-accent shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <o.icon className="w-6 h-6 mb-2" />
                  <span className="font-medium text-xs text-center">{o.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentStepIndex === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {recipients.map(r => (
                <button
                  key={r.id}
                  onClick={() => setQuizState(s => ({ ...s, recipient: r.id as Recipient }))}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all duration-200 ${quizState.recipient === r.id ? 'border-accent bg-accent/5 text-accent shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <r.icon className="w-8 h-8 mb-3" />
                  <span className="font-medium text-sm text-center">{r.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentStepIndex === 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ageGroups.map(a => (
                <button
                  key={a.id}
                  onClick={() => setQuizState(s => ({ ...s, ageGroup: a.id as AgeGroup }))}
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 ${quizState.ageGroup === a.id ? 'border-accent bg-accent/5 text-accent shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <span className="font-medium text-lg text-center">{a.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentStepIndex === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {genders.map(g => (
                <button
                  key={g.id}
                  onClick={() => setQuizState(s => ({ ...s, gender: g.id as Gender }))}
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 ${quizState.gender === g.id ? 'border-accent bg-accent/5 text-accent shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <span className="font-medium text-lg text-center">{g.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentStepIndex === 4 && (
            <div>
              <p className="text-sm text-gray-500 text-center mb-6">Select up to 3 interests.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {interestsList.map(i => {
                  const isSelected = quizState.interests.includes(i.id as Interest);
                  const isMaxed = quizState.interests.length >= 3;
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggleInterest(i.id as Interest)}
                      disabled={!isSelected && isMaxed}
                      className={`flex items-center gap-3 p-3 border-2 rounded-xl transition-all duration-200 text-left
                        ${isSelected ? 'border-accent bg-accent/5 text-accent shadow-sm' : 'border-gray-100 hover:border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    >
                      <i.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm leading-tight flex-grow">{i.label}</span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStepIndex === 5 && (
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              {budgets.map(b => (
                <button
                  key={b.id}
                  onClick={() => setQuizState(s => ({ ...s, budget: b.id as Budget }))}
                  className={`flex items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 ${quizState.budget === b.id ? 'border-accent bg-accent/5 text-accent shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <span className="font-medium text-lg text-center">{b.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentStepIndex === 6 && (
            <div className="max-w-sm mx-auto flex flex-col gap-6 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <Gift className="w-12 h-12 text-accent mx-auto mb-4" />
                <p className="text-gray-600">
                  We've found 3 perfect gifts! Tell us where to send your curated recommendations.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={emailState.firstName}
                    onChange={(e) => setEmailState(s => ({ ...s, firstName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder="Jane"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={emailState.email}
                    onChange={(e) => setEmailState(s => ({ ...s, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder="jane@example.com"
                    required
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-center text-sm font-medium">
            {submitError}
          </div>
        )}

        <div className="mt-10 flex justify-between items-center pt-6 border-t border-gray-100">
          <button
            onClick={prevStep}
            className={`px-6 py-2 rounded-xl font-medium transition-colors ${currentStepIndex === 0 ? 'invisible' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            ← Back
          </button>
          
          {currentStepIndex < 6 ? (
            <button
              onClick={nextStep}
              disabled={!isStepValid() || isSubmitting}
              className="bg-primary text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
            >
              {isSubmitting && currentStepIndex === 5 && userEmail ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Finding Gifts...
                </>
              ) : (
                "Continue"
              )}
            </button>
          ) : (
            <button
              onClick={() => submitQuiz(emailState.firstName, emailState.email)}
              disabled={!isStepValid() || isSubmitting}
              className="bg-accent text-white px-8 py-3 rounded-xl font-semibold hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Finding Gifts...
                </>
              ) : (
                "Get My Matches ✨"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
