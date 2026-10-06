import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className='text-center py-20'>
      <h1 className='text-6xl font-bold text-gray-900'>404</h1>
      <p className='mt-2 text-xl text-gray-600'>Page not found.</p>
      <Link to='/' className='mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition'>
        Go Back Home
      </Link>
    </div>
  );
};

export default NotFound;