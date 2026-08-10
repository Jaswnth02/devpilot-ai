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
    <div className="min-h-screen flex items-center justify-center bg-[#070b13] px-4 py-12 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-xl glass p-8 rounded-2xl shadow-2xl border border-white/5 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[11px] font-medium text-indigo-300">Join DevPilot AI</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Create Workspace Account</h2>
          <p className="text-slate-400 text-xs mt-2">Plan, allocate, and automate software engineering workflows</p>
        </div>

        {validationError && (
          <div className="mb-6 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2.5 animate-fadeIn">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white placeholder-slate-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 pl-1 mt-1 block">Min 8 chars (1 upper, 1 lower, 1 number)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Workspace Role & Experience Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Workspace Role</label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 z-10 pointer-events-none" />
                <select
                  value={workspaceRole}
                  onChange={(e) => setWorkspaceRole(e.target.value)}
                  className="w-full py-3 pl-10 pr-4 rounded-xl glass-input text-sm text-white outline-none bg-[#0c1220] cursor-pointer"
                >
                  {WORKSPACE_ROLES.map((role) => (
                    <option key={role} value={role} className="bg-[#0c1220] text-slate-200">
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full py-3 px-4 rounded-xl glass-input text-sm text-white outline-none bg-[#0c1220] cursor-pointer"
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level} className="bg-[#0c1220] text-slate-200">
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Skills Multi-Selection & Tag Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">
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
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5'
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
                <Award className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyDown={handleAddCustomSkill}
                  placeholder="Type a skill and press Enter..."
                  className="w-full py-2.5 pl-10 pr-4 rounded-xl glass-input text-xs text-white placeholder-slate-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomSkill}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium border border-white/10 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Active Selected Skills Chips */}
            {selectedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Selected:</span>
                {selectedSkills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s)}
                      className="hover:text-rose-400 text-slate-400 font-bold ml-1"
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
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className="text-xs text-slate-400 leading-relaxed">
                I accept the <a href="#" onClick={(e) => e.preventDefault()} className="text-indigo-400 hover:underline">Terms and Conditions</a> and Privacy Policy for DevPilot AI.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
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

        <div className="mt-6 text-center text-xs text-slate-400">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
