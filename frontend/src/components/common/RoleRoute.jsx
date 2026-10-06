import { Navigate, useLocation } from 'react-router-dom';

export default function RoleRoute({ allowedRoles, children }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const location = useLocation();

  if (!token || !userStr) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  try {
    const user = JSON.parse(userStr);
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(user.role)) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center shadow-sm">
            <h2 className="text-xl font-bold text-red-800 mb-2">Access Restricted</h2>
            <p className="text-red-600 text-sm mb-6">
              Your account ({user.role}) does not have permission to access this area.
            </p>
            <a
              href="/"
              className="inline-block px-5 py-2.5 bg-red-600 text-white font-medium text-sm rounded-xl hover:bg-red-700 transition"
            >
              Return to Marketplace
            </a>
          </div>
        </div>
      );
    }

    return children;
  } catch (err) {
    return <Navigate to="/login" replace />;
  }
}
