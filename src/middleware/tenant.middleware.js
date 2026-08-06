function enforceTenantScope(req, res, next) {
  if (req.auth.isPlatformOwner) {
    return next();
  }

  if (!req.auth.companyId) {
    return res.status(403).json({ error: 'Account is not linked to a company' });
  }

  if (req.body && 'company_id' in req.body) delete req.body.company_id;
  if (req.query && 'company_id' in req.query) delete req.query.company_id;

  req.tenantContext = {
    companyId: req.auth.companyId,
    isPlatformOwner: false,
  };
  next();
}

module.exports = { enforceTenantScope };
