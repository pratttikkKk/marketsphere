import ProductList from './products/ProductList';

const Home = () => {
  return (
    <div className='py-8'>
      <div className='mb-8 text-center'>
        <h1 className='text-4xl font-extrabold text-gray-900 sm:text-5xl'>
          Welcome to MarketSphere
        </h1>
        <p className='mt-4 text-lg text-gray-500'>
          The ultimate multi-vendor e-commerce platform.
        </p>
      </div>
      <ProductList />
    </div>
  );
};

export default Home;