class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    // Remove empty filters (common from frontend selects/inputs)
    Object.keys(queryObj).forEach((key) => {
      const value = queryObj[key];
      if (value === '' || value === null || value === undefined) delete queryObj[key];
    });

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.paginationInfo = {
      page,
      limit,
      skip,
    };
    
    return this;
  }

  async execute() {
    const results = await this.query;
    const total = await this.query.model.countDocuments(this.query._conditions);
    
    return {
      results,
      pagination: {
        page: this.paginationInfo?.page || 1,
        limit: this.paginationInfo?.limit || 10,
        total,
        pages: Math.ceil(total / (this.paginationInfo?.limit || 10)),
      },
    };
  }
}

export default APIFeatures;
