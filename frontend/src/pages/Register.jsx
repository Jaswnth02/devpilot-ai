import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, Lock, ShieldAlert, Award, Briefcase, CheckSquare, Sparkles, Github } from 'lucide-react';

const WORKSPACE_ROLES = [
  'Developer / Engineer',
  'Project Manager',
  'Designer',
  'Product Manager',
  'Student',
  'Other'
];

const EXPERIENCE_LEVELS = [
  'Beginner',
  'Entry-Level',
  'Mid-Level',
  'Senior',
  'Expert'
];

const POPULAR_SKILLS = [
  'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python',
  'MongoDB', 'Express', 'Tailwind CSS', 'SQL', 'Docker', 'Git'
];

const Register = () => {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workspaceRole, setWorkspaceRole] = useState('Developer / Engineer');
  const [experienceLevel, setExperienceLevel] = useState('Entry-Level');
  const [selectedSkills, setSelectedSkills] = useState(['React', 'Node.js']);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Toggle skill selection
  const handleToggleSkill = (skillName) => {
    if (selectedSkills.includes(skillName)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skillName));
    } else {
      setSelectedSkills([...selectedSkills, skillName]);
    }
  };

  // Add custom skill
  const handleAddCustomSkill = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const trimmed = customSkillInput.trim();
      if (trimmed && !selectedSkills.includes(trimmed)) {
        setSelectedSkills([...selectedSkills, trimmed]);
        setCustomSkillInput('');
      }
    }
  };

  // Remove skill tag
  const handleRemoveSkill = (skillToRemove) => {
    setSelectedSkills(selectedSkills.filter(s => s !== skillToRemove));
  };

  // Comprehensive Frontend Validation
  const validateForm = () => {
    if (!fullName || fullName.trim().length < 2) {
      return 'Full Name is required and must be at least 2 characters.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return 'Please enter a valid email address.';
    }

    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter (A-Z).';
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter (a-z).';
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number (0-9).';
    }

    if (password !== confirmPassword) {
      return 'Confirm Password does not match the entered password.';
    }

    if (!workspaceRole) {
      return 'Please select your Workspace Role.';
    }

    if (!experienceLevel) {
      return 'Please select your Experience Level.';
    }

    if (selectedSkills.length === 0) {
      return 'Please select or add at least one skill.';
    }

    if (!acceptedTerms) {
      return 'You must accept the Terms and Conditions to create an account.';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const errorMsg = validateForm();
    if (errorMsg) {
      setValidationError(errorMsg);
      return;
    }

    setLoading(true);

    try {
      const response = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        workspaceRole,
        experienceLevel,
        skills: selectedSkills
      });

      // Redirect to verification page with email state
      navigate('/verify-email', {
        state: {
          email: response?.email || email.trim()
        }
      });
    } catch (err) {
      setValidationError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Background Soft Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl"></div>

      <div className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-xl border border-slate-200 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-[11px] font-medium text-indigo-700">Join DevPilot AI</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Workspace Account</h2>
          <p className="text-slate-500 text-xs mt-2">Plan, allocate, and automate software engineering workflows</p>
        </div>

        {validationError && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2.5 animate-fadeIn">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
              <span className="text-[10px] text-slate-500 pl-1 mt-1 block">Min 8 chars (1 upper, 1 lower, 1 number)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Workspace Role & Experience Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Workspace Role</label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 z-10 pointer-events-none" />
                <select
                  value={workspaceRole}
                  onChange={(e) => setWorkspaceRole(e.target.value)}
                  className="w-full py-3 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 outline-none cursor-pointer focus:border-indigo-600 focus:bg-white"
                >
                  {WORKSPACE_ROLES.map((role) => (
                    <option key={role} value={role} className="text-slate-800">
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 outline-none cursor-pointer focus:border-indigo-600 focus:bg-white"
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level} className="text-slate-800">
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Skills Multi-Selection & Tag Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">
              Skills (select or type custom skill)
            </label>

            {/* Popular Skills Pills */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {POPULAR_SKILLS.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleToggleSkill(skill)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{skill}
                  </button>
                );
              })}
            </div>

            {/* Custom Skill Add */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Award className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyDown={handleAddCustomSkill}
                  placeholder="Type a skill and press Enter..."
                  className="w-full py-2.5 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomSkill}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-medium border border-slate-300 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Active Selected Skills Chips */}
            {selectedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 self-center mr-1">Selected:</span>
                {selectedSkills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s)}
                      className="hover:text-rose-600 text-slate-400 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Terms & Conditions Checkbox */}
          <div className="pt-2">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                I accept the <a href="#" onClick={(e) => e.preventDefault()} className="text-indigo-600 hover:underline font-medium">Terms and Conditions</a> and Privacy Policy for DevPilot AI.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm text-white shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Sending Verification Code...</span>
              </>
            ) : (
              <span>Create Account & Verify Email</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
